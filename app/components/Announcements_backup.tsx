'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Announcement {
  id: string;
  content: string;
  created_at: string;
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('获取公告失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setEditContent(announcement.content);
  };

  const handleSave = async () => {
    if (!editingId) return;

    try {
      const { error } = await supabase
        .from('announcements')
        .update({ content: editContent })
        .eq('id', editingId);

      if (error) throw error;

      setAnnouncements(prev =>
        prev.map(ann =>
          ann.id === editingId ? { ...ann, content: editContent } : ann
        )
      );
      setEditingId(null);
      setEditContent('');
    } catch (error) {
      console.error('更新公告失败:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条公告吗？')) return;

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setAnnouncements(prev => prev.filter(ann => ann.id !== id));
    } catch (error) {
      console.error('删除公告失败:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-6 h-6 bg-gray-600 rounded animate-pulse"></div>
          <div className="w-12 h-4 bg-gray-600 rounded animate-pulse"></div>
        </div>
        <div className="space-y-2">
          <div className="w-full h-4 bg-gray-600 rounded animate-pulse"></div>
          <div className="w-3/4 h-4 bg-gray-600 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center space-x-2 mb-4">
        <div className="w-6 h-6 bg-gray-600 rounded flex items-center justify-center">
          <span className="text-xs">📢</span>
        </div>
        <h3 className="text-white font-medium">公告</h3>
      </div>

      {announcements.length === 0 ? (
        <p className="text-gray-400 text-sm">暂无公告</p>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="border-l-4 border-blue-500 pl-4">
              <div className="text-gray-300 mb-2">
                {editingId === announcement.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-2 bg-gray-700 text-white rounded resize-none"
                      rows={3}
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSave}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditContent('');
                        }}
                        className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm leading-relaxed">{announcement.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center text-xs text-gray-500">
                        <span className="mr-2">🕐</span>
                        {format(new Date(announcement.created_at), 'yyyy/M/d HH:mm:ss', {
                          locale: zhCN,
                        })}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(announcement)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center space-x-1"
                        >
                          <span>✏️</span>
                          <span>编辑</span>
                        </button>
                        <button
                          onClick={() => handleDelete(announcement.id)}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 flex items-center space-x-1"
                        >
                          <span>🗑️</span>
                          <span>删除</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}