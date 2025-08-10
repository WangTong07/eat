import { useEffect } from 'react';
import { getSupabaseClient } from './supabaseClient';

type RealtimeConfig = {
  table: string;
  onUpdate?: () => void;
  onInsert?: () => void;
  onDelete?: () => void;
  onChange?: () => void; // 任何变更都触发
};

/**
 * Supabase Realtime 订阅 Hook
 * 用于监听表变更并自动刷新数据
 */
export function useRealtimeSubscription(config: RealtimeConfig) {
  const { table, onUpdate, onInsert, onDelete, onChange } = config;

  useEffect(() => {
    const supabase = getSupabaseClient();
    
    const channel = supabase
      .channel(`realtime:${table}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: table 
        },
        (payload) => {
          console.log(`[Realtime] ${table} changed:`, payload);
          
          // 根据事件类型调用对应回调
          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.();
              break;
            case 'UPDATE':
              onUpdate?.();
              break;
            case 'DELETE':
              onDelete?.();
              break;
          }
          
          // 通用变更回调
          onChange?.();
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] ${table} subscription status:`, status);
      });

    return () => {
      console.log(`[Realtime] Unsubscribing from ${table}`);
      supabase.removeChannel(channel);
    };
  }, [table, onUpdate, onInsert, onDelete, onChange]);
}

/**
 * 多表订阅 Hook
 */
export function useMultiTableRealtime(tables: string[], onAnyChange: () => void) {
  useEffect(() => {
    const supabase = getSupabaseClient();
    const channels: any[] = [];

    tables.forEach(table => {
      const channel = supabase
        .channel(`realtime:${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            console.log(`[Realtime] ${table} changed:`, payload);
            onAnyChange();
          }
        )
        .subscribe();
      
      channels.push(channel);
    });

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [tables, onAnyChange]);
}