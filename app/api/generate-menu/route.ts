import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    console.log('[generate-menu] start');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return NextResponse.json(
        { error: "缺少 Supabase 环境变量，请在 .env.local 设置 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY" },
        { status: 500 }
      );
    }
    const supabase = createClient(url, anon);

    const { budget, onDutyUserName } = await req
      .json()
      .catch(() => ({ budget: undefined, onDutyUserName: undefined }));

    // 预先计算本周编号（ISO 年*100 + 周数）供查询与写入
    const nowForWeek = new Date();
    const tempDate0 = new Date(Date.UTC(nowForWeek.getFullYear(), nowForWeek.getMonth(), nowForWeek.getDate()));
    const dayNum0 = tempDate0.getUTCDay() || 7;
    tempDate0.setUTCDate(tempDate0.getUTCDate() + 4 - dayNum0);
    const yearStart0 = new Date(Date.UTC(tempDate0.getUTCFullYear(), 0, 1));
    const weekNo0 = Math.ceil((((tempDate0.getTime() - yearStart0.getTime()) / 86400000) + 1) / 7);
    const weekNumber = tempDate0.getUTCFullYear() * 100 + weekNo0;

    // 1) 读取所有待处理的心愿
    const { data: wishes, error: wishErr } = await supabase
      .from("menu_wishes")
      .select("id, user_name, request_type, content, status")
      .eq("status", "待处理");
    if (wishErr) throw wishErr;
    console.log('[generate-menu] wishes:', (wishes || []).length);

    type Wish = {
      id: string;
      user_name: string;
      request_type: "想吃的菜" | "忌口" | string;
      content: string;
      status: "待处理" | "已采纳" | "已完成" | string;
    };
    const wishList: Wish[] = (wishes as unknown as Wish[]) ?? [];

    // 1.1) 读取本周吃饭人数（若无设置，则默认 5）
    let headcount = 5;
    try {
      const { data: hcRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "headcount")
        .eq("week_number", weekNumber)
        .maybeSingle();
      if (hcRow && typeof hcRow.value !== 'undefined') {
        const v = Number((hcRow as any).value);
        if (!Number.isNaN(v) && v > 0) headcount = v;
      }
    } catch (_) {
      // 表不存在时忽略，使用默认值
    }

    // 2) 组织 Prompt（包含固定规则 + 心愿/忌口 + 预算 + 人数与规模化规则）
    const fixedRules = [
      `为${headcount}个成年人规划5天晚餐（周一至周五）`,
      "必须采购15斤猪五花肉",
      "每周去钱大妈买1-2次包桌菜",
    ];
    const scalingGuides = [
      "人数与菜品数量规则：1-3人每天2-3道，4-6人每天3-4道，7-9人每天4-5道，10-12人每天5-6道",
      "人数与份量规则：请在购物清单中反映数量/重量（带上单位），以满足上述人数，一般每道主菜按每人200-250g荤菜，配1-2道素菜",
      "采购频次：一周采购两次，建议周一和周四。周一采购耐放/整周使用的食材；周四补充易耗易蔫的叶菜/水果/鲜肉",
      "清单需按供应渠道分组：海吉星、钱大妈、其他，并标注数量与单位",
    ];
    const likes = wishList
      .filter((w) => w.request_type === "想吃的菜")
      .map((w) => `- [${w.id}] ${w.user_name}: ${w.content}`);
    const dislikes = wishList
      .filter((w) => w.request_type === "忌口")
      .map((w) => `- [${w.id}] ${w.user_name}: ${w.content}`);

    const prompt = [
      "你是一个资深家常菜菜单规划助手。",
      `固定规则：\n${fixedRules.map((r) => `- ${r}`).join("\n")}`,
      `规模化与采购规则：\n${scalingGuides.map((r) => `- ${r}`).join("\n")}`,
      likes.length ? `想吃的菜：\n${likes.join("\n")}` : "想吃的菜：无",
      dislikes.length ? `忌口：\n${dislikes.join("\n")}` : "忌口：无",
      budget ? `预算限制：${budget}` : "",
      "请输出严格的 JSON（仅 JSON，无额外文本），形如：{\n  \"menu\": {\n    \"周一\": [\"菜1\", \"菜2\"],\n    \"周二\": [\"...\"]\n  },\n  \"shopping_list\": {\n    \"周一采购\": { \"海吉星\": [\"食材A 2kg\", \"...\"], \"钱大妈\": [\"...\"], \"其他\": [\"...\"] },\n    \"周四采购\": { \"海吉星\": [\"...\"], \"钱大妈\": [\"...\"], \"其他\": [\"...\"] }\n  },\n  \"adopted_wish_ids\": [\"心愿ID1\", \"心愿ID2\"]\n}\n注意：\n1) 菜品数量与${headcount}人相匹配；\n2) 购物清单必须标注数量与单位并按两次采购拆分；\n3) adopted_wish_ids 仅从上面提供的心愿 ID 中选择。",
    ]
      .filter(Boolean)
      .join("\n\n");

    // 3) 调用外部 AI（以 OpenAI 风格为例；你可以换成其他兼容 API）
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "缺少 AI_API_KEY" }, { status: 400 });
    }
    const apiBase = process.env.AI_API_BASE || "https://api.openai.com/v1/chat/completions";
    const model = process.env.AI_MODEL || "gpt-4o-mini";

    const aiRes = await fetch(apiBase, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是一个严谨的结构化输出助手。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error('[generate-menu] AI 调用失败:', text);
      return NextResponse.json({ error: `AI 调用失败: ${text}` }, { status: 500 });
    }

    const aiJson = await aiRes.json();
    let content: string = aiJson?.choices?.[0]?.message?.content || "";
    // 去除可能的代码围栏
    if (content.includes('```')) {
      content = content.replace(/```json\s*[\r\n]?/gi, '```');
      const first = content.indexOf('```');
      const last = content.lastIndexOf('```');
      if (first !== -1 && last !== -1 && last > first) {
        content = content.slice(first + 3, last).trim();
      }
    }
    console.log('[generate-menu] ai content length:', content.length);

    // 4) 解析 AI 返回（期望是 JSON 文本）
    interface AIResponseShape {
      menu?: Record<string, string[] | string>;
      shopping_list?: Record<string, string[] | string>;
      adopted_wish_ids?: string[];
    }
    let parsedUnknown: unknown;
    try {
      parsedUnknown = JSON.parse(content);
    } catch {
      console.error('[generate-menu] JSON 解析失败，原始片段:', content?.slice?.(0, 200));
      return NextResponse.json({ error: "AI 响应不是合法 JSON", raw: content }, { status: 500 });
    }
    const parsed = parsedUnknown as AIResponseShape;

    // 5) 入库 weekly_plans，同时更新被采纳心愿状态
    const menuJson = parsed.menu ?? {};
    const shoppingJson = parsed.shopping_list ?? {};

    // 周编号已在前面计算：weekNumber

    const { error: insertErr } = await supabase.from("weekly_plans").insert({
      week_number: weekNumber,
      menu_json: menuJson,
      shopping_list_json: shoppingJson,
      raw_ai_response: content,
    });
    if (insertErr) throw insertErr;
    console.log('[generate-menu] weekly_plans inserted for week', weekNumber);

    // 仅更新被采纳的心愿；若模型未返回则回退为全部待处理心愿
    // 仅在存在待处理心愿时才尝试更新，且过滤非法/不属于本轮的 ID
    let updatedCount = 0;
    if (wishList.length > 0) {
      const candidateIds = Array.isArray(parsed.adopted_wish_ids)
        ? parsed.adopted_wish_ids
        : [];
      const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      const validSet = new Set(wishList.map((w) => w.id));
      const adoptedIds = candidateIds.filter((id) => uuidRe.test(id) && validSet.has(id));

      if (adoptedIds.length > 0) {
        const { error: updErr } = await supabase
          .from("menu_wishes")
          .update({ status: "已采纳" })
          .in("id", adoptedIds);
        if (updErr) throw updErr;
        updatedCount = adoptedIds.length;
      }
    }
    console.log('[generate-menu] wishes updated:', updatedCount);

    // 如果提供了值班人姓名，则同步更新/插入本周值班表
    if (onDutyUserName && typeof onDutyUserName === "string") {
      // 计算本周起止（周一为一周开始）
      const now = new Date();
      const start = new Date(now);
      const day = start.getDay() || 7; // 周日=0，转为7
      start.setDate(start.getDate() - (day - 1));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      // 无唯一键时，采用 select → update/insert 逻辑，避免 upsert 失败
      const { data: exist, error: selErr } = await supabase
        .from("schedules")
        .select("id")
        .eq("week_number", weekNumber)
        .limit(1);
      if (selErr) throw selErr;

      if (exist && exist.length > 0) {
        const { error: updErr2 } = await supabase
          .from("schedules")
          .update({
            start_date: start.toISOString().slice(0, 10),
            end_date: end.toISOString().slice(0, 10),
            user_name: onDutyUserName,
            status: "进行中",
          })
          .eq("id", exist[0].id);
        if (updErr2) throw updErr2;
        console.log('[generate-menu] schedule updated for', onDutyUserName);
      } else {
        const { error: insErr2 } = await supabase.from("schedules").insert({
          week_number: weekNumber,
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
          user_name: onDutyUserName,
          status: "进行中",
        });
        if (insErr2) throw insErr2;
        console.log('[generate-menu] schedule inserted for', onDutyUserName);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else if (typeof err === 'object' && err && 'message' in (err as any)) {
      message = String((err as any).message);
    } else {
      try {
        message = JSON.stringify(err);
      } catch {
        message = String(err);
      }
    }
    console.error('[generate-menu] fatal:', message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


