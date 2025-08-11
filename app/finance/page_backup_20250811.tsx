// 备份文件 - 2025年8月11日 21:00
// 如果新样式不满意，可以恢复到这个版本

'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Trash2, Plus, Edit2, Save, X } from "lucide-react"
import { toast } from "sonner"

interface Expense {
  id: string
  amount: number
  description: string
  date: string
  category: string
  created_at: string
}

interface WeeklyExpense {
  week_start: string
  week_end: string
  total_amount: number
}

interface MemberExpense {
  member_name: string
  total_amount: number
  is_paid: boolean
}

export default function FinancePage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [weeklyExpenses, setWeeklyExpenses] = useState<WeeklyExpense[]>([])
  const [memberExpenses, setMemberExpenses] = useState<MemberExpense[]>([])
  const [budget, setBudget] = useState(5000)
  const [newExpense, setNewExpense] = useState({
    amount: '',
    description: '',
    category: '食材'
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchExpenses()
    fetchWeeklyExpenses()
    fetchMemberExpenses()
  }, [])

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error
      setExpenses(data || [])
    } catch (error) {
      console.error('获取支出记录失败:', error)
      toast.error('获取支出记录失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchWeeklyExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_expenses')
        .select('*')
        .order('week_start', { ascending: false })

      if (error) throw error
      setWeeklyExpenses(data || [])
    } catch (error) {
      console.error('获取每周支出失败:', error)
    }
  }

  const fetchMemberExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('member_expenses')
        .select('*')
        .order('member_name')

      if (error) throw error
      setMemberExpenses(data || [])
    } catch (error) {
      console.error('获取成员费用失败:', error)
    }
  }

  const addExpense = async () => {
    if (!newExpense.amount || !newExpense.description) {
      toast.error('请填写完整信息')
      return
    }

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert([{
          amount: parseFloat(newExpense.amount),
          description: newExpense.description,
          category: newExpense.category,
          date: new Date().toISOString().split('T')[0]
        }])
        .select()

      if (error) throw error

      setNewExpense({ amount: '', description: '', category: '食材' })
      fetchExpenses()
      fetchWeeklyExpenses()
      fetchMemberExpenses()
      toast.success('支出记录添加成功')
    } catch (error) {
      console.error('添加支出记录失败:', error)
      toast.error('添加支出记录失败')
    }
  }

  const deleteExpense = async (id: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (error) throw error

      fetchExpenses()
      fetchWeeklyExpenses()
      fetchMemberExpenses()
      toast.success('支出记录删除成功')
    } catch (error) {
      console.error('删除支出记录失败:', error)
      toast.error('删除支出记录失败')
    }
  }

  const startEdit = (expense: Expense) => {
    setEditingId(expense.id)
    setEditingExpense({ ...expense })
  }

  const saveEdit = async () => {
    if (!editingExpense) return

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          amount: editingExpense.amount,
          description: editingExpense.description,
          category: editingExpense.category
        })
        .eq('id', editingExpense.id)

      if (error) throw error

      setEditingId(null)
      setEditingExpense(null)
      fetchExpenses()
      fetchWeeklyExpenses()
      fetchMemberExpenses()
      toast.success('支出记录更新成功')
    } catch (error) {
      console.error('更新支出记录失败:', error)
      toast.error('更新支出记录失败')
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingExpense(null)
  }

  const togglePaymentStatus = async (memberName: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('member_expenses')
        .update({ is_paid: !currentStatus })
        .eq('member_name', memberName)

      if (error) throw error

      fetchMemberExpenses()
      toast.success(`${memberName}的缴费状态已更新`)
    } catch (error) {
      console.error('更新缴费状态失败:', error)
      toast.error('更新缴费状态失败')
    }
  }

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const budgetUsed = (totalExpenses / budget) * 100
  const remainingBudget = budget - totalExpenses

  const totalMembers = memberExpenses.length
  const paidMembers = memberExpenses.filter(m => m.is_paid).length
  const unpaidMembers = totalMembers - paidMembers

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">财务管理</h1>

      {/* 预算概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💰 本月预算概览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold">
                ¥{totalExpenses.toFixed(2)} / ¥{budget.toFixed(2)}
              </span>
              <Badge variant={remainingBudget >= 0 ? "default" : "destructive"}>
                结余: ¥{remainingBudget.toFixed(2)}
              </Badge>
            </div>
            <Progress value={Math.min(budgetUsed, 100)} className="h-3" />
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-500">总人数</div>
                <div className="text-xl font-bold">{totalMembers}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">已交费</div>
                <div className="text-xl font-bold text-green-600">{paidMembers}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">未交费</div>
                <div className="text-xl font-bold text-red-600">{unpaidMembers}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 每周支出汇总 */}
      <Card>
        <CardHeader>
          <CardTitle>📊 本月每周支出汇总</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">周编号</th>
                  <th className="text-right p-2">支出金额</th>
                </tr>
              </thead>
              <tbody>
                {weeklyExpenses.map((week, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">
                      {new Date(week.week_start).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}-
                      {new Date(week.week_end).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}日
                    </td>
                    <td className="p-2 text-right font-mono">¥{week.total_amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 支出记录 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            📝 支出记录
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              展开
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 添加新支出 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="amount">金额</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="description">描述</Label>
              <Input
                id="description"
                placeholder="支出描述"
                value={newExpense.description}
                onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="category">分类</Label>
              <select
                id="category"
                className="w-full p-2 border rounded-md"
                value={newExpense.category}
                onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
              >
                <option value="食材">食材</option>
                <option value="调料">调料</option>
                <option value="设备">设备</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={addExpense} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                添加
              </Button>
            </div>
          </div>

          {/* 支出列表 */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">日期</th>
                  <th className="text-left p-2">描述</th>
                  <th className="text-left p-2">分类</th>
                  <th className="text-right p-2">金额</th>
                  <th className="text-center p-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-b">
                    {editingId === expense.id ? (
                      <>
                        <td className="p-2">{expense.date}</td>
                        <td className="p-2">
                          <Input
                            value={editingExpense?.description || ''}
                            onChange={(e) => setEditingExpense(prev => 
                              prev ? {...prev, description: e.target.value} : null
                            )}
                          />
                        </td>
                        <td className="p-2">
                          <select
                            className="w-full p-1 border rounded"
                            value={editingExpense?.category || ''}
                            onChange={(e) => setEditingExpense(prev => 
                              prev ? {...prev, category: e.target.value} : null
                            )}
                          >
                            <option value="食材">食材</option>
                            <option value="调料">调料</option>
                            <option value="设备">设备</option>
                            <option value="其他">其他</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={editingExpense?.amount || 0}
                            onChange={(e) => setEditingExpense(prev => 
                              prev ? {...prev, amount: parseFloat(e.target.value) || 0} : null
                            )}
                          />
                        </td>
                        <td className="p-2">
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" onClick={saveEdit}>
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-2">{expense.date}</td>
                        <td className="p-2">{expense.description}</td>
                        <td className="p-2">
                          <Badge variant="outline">{expense.category}</Badge>
                        </td>
                        <td className="p-2 text-right font-mono">¥{expense.amount.toFixed(2)}</td>
                        <td className="p-2">
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" variant="outline" onClick={() => startEdit(expense)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteExpense(expense.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 成员缴费统计 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            👥 成员缴费统计（本月）
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              展开
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">成员姓名</th>
                  <th className="text-right p-2">应缴金额</th>
                  <th className="text-center p-2">缴费状态</th>
                  <th className="text-center p-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {memberExpenses.map((member) => (
                  <tr key={member.member_name} className="border-b">
                    <td className="p-2">{member.member_name}</td>
                    <td className="p-2 text-right font-mono">¥{member.total_amount.toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <Badge variant={member.is_paid ? "default" : "destructive"}>
                        {member.is_paid ? "已缴费" : "未缴费"}
                      </Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        size="sm"
                        variant={member.is_paid ? "outline" : "default"}
                        onClick={() => togglePaymentStatus(member.member_name, member.is_paid)}
                      >
                        {member.is_paid ? "标记未缴费" : "标记已缴费"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}