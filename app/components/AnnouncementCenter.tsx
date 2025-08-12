'use client';

import { useState, useEffect, useRef } from 'react';

interface Announcement {
  id: string;
  content: string;
  created_at: string;
  is_active: boolean;
  author?: string;
}

export default function AnnouncementCenter() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formContent, setFormContent] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableNames, setAvailableNames] = useState<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchAnnouncements();
    fetchAvailableNames();
  }, []);

  const fetchAvailableNames = async () => {
    try {
      const res = await fetch('/api/people');
      const data = await res.json();
      if (res.ok) {
        setAvailableNames(data.names || []);
      } else {
        console.error('获取人员列表失败:', data.error);
      }
    } catch (error) {
      console.error('获取人员列表失败:', error);
    }
  };

  // 智能滚动逻辑 - 2秒间隔，支持手动控制
  const [isManualScrolling, setIsManualScrolling] = useState(false);
  const [scrollTimeout, setScrollTimeout] = useState<NodeJS.Timeout | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 自动滚动逻辑
  useEffect(() => {
    if (announcements.length <= 1 || isPaused || isManualScrolling) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const maxIndex = Math.max(0, announcements.length - 1);
        return prev >= maxIndex ? 0 : prev + 1;
      });
    }, 2000); // 2秒切换一次

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [announcements.length, isPaused, isManualScrolling]);

  // 处理手动滚动
  const handleScroll = () => {
    setIsManualScrolling(true);
    
    // 清除之前的定时器
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    
    // 设置新的定时器，1.5秒后恢复自动滚动
    const newTimeout = setTimeout(() => {
      setIsManualScrolling(false);
    }, 1500);
    
    setScrollTimeout(newTimeout);
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [scrollTimeout]);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements');
      const data = await res.json();
      if (res.ok) {
        setAnnouncements(data.items || []);
      } else {
        console.error('获取公告失败:', data.error);
      }
    } catch (error) {
      console.error('获取公告失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAnnouncement = async () => {
    if (!formContent.trim() || !formAuthor.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: formContent.trim(), 
          author: formAuthor.trim(),
          is_active: true 
        })
      });
      
      if (res.ok) {
        setFormContent('');
        setFormAuthor('');
        setShowAddForm(false);
        fetchAnnouncements();
      } else {
        const data = await res.json();
        alert('发布失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      alert('发布失败: ' + error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAnnouncement = async (id: string) => {
    const finalAuthor = formAuthor === 'custom' ? customAuthor.trim() : formAuthor.trim();
    if (!formContent.trim() || !finalAuthor || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id, 
          content: formContent.trim(), 
          author: finalAuthor,
          is_active: true 
        })
      });
      
      if (res.ok) {
        setFormContent('');
        setFormAuthor('');
        setCustomAuthor('');
        setEditingId(null);
        fetchAnnouncements();
      } else {
        const data = await res.json();
        alert('更新失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      alert('更新失败: ' + error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('确定要删除这条公告吗？')) return;
    
    try {
      const res = await fetch('/api/announcements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      
      if (res.ok) {
        fetchAnnouncements();
      } else {
        const data = await res.json();
        alert('删除失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      alert('删除失败: ' + error);
    }
  };

  const startEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setFormContent(announcement.content);
    const author = announcement.author || '';
    if (availableNames.includes(author)) {
      setFormAuthor(author);
      setCustomAuthor('');
    } else {
      setFormAuthor('custom');
      setCustomAuthor(author);
    }
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormContent('');
    setFormAuthor('');
    setCustomAuthor('');
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    setFormContent('');
    setFormAuthor('');
    setCustomAuthor('');
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border border-amber-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-4 mb-6">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-sm">📢</span>
          </div>
          <div className="w-16 h-4 bg-amber-600/30 rounded animate-pulse"></div>
        </div>
        <div className="space-y-3">
          <div className="w-full h-12 bg-amber-700/20 rounded animate-pulse"></div>
          <div className="w-full h-12 bg-amber-700/20 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border border-amber-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-4 mb-6">
        {/* 标题栏 - 包含发布按钮 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white text-sm">📢</span>
            </div>
            <div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                公告中心
              </h2>
              <p className="text-amber-400/70 font-medium text-xs">发布和管理系统公告</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* 发布按钮 */}
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-green-900/40 text-green-400 border border-green-700/50 px-2 py-1 rounded-full text-xs font-semibold hover:bg-green-800/40 transition-all duration-200"
            >
              + 发布
            </button>
          </div>
        </div>

        {/* 发布公告表单 */}
        {showAddForm && (
          <div className="mb-4 p-3 bg-gray-800/40 backdrop-blur-sm rounded-lg border border-amber-700/20">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-amber-400 text-sm font-medium">发布新公告</h4>
              <button
                onClick={cancelAdd}
                className="text-amber-400/70 hover:text-amber-400 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              <div className="space-y-2">
                <select
                  value={formAuthor}
                  onChange={(e) => setFormAuthor(e.target.value)}
                  className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-amber-700/30 focus:border-amber-600/50 focus:outline-none"
                >
                  <option value="">选择发布人...</option>
                  {availableNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value="custom">手动输入...</option>
                </select>
                        {formAuthor === 'custom' && (
                          <input
                            type="text"
                            value={customAuthor}
                            onChange={(e) => setCustomAuthor(e.target.value)}
                            placeholder="请输入发布人姓名..."
                            className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-amber-700/30 focus:border-amber-600/50 focus:outline-none"
                            maxLength={50}
                            autoFocus
                          />
                        )}
              </div>
              
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="输入公告内容..."
                className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-amber-700/30 focus:border-amber-600/50 focus:outline-none resize-none"
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-amber-400/70">{formContent.length}/500</span>
              <button
                onClick={handleAddAnnouncement}
                disabled={!formContent.trim() || !(formAuthor === 'custom' ? customAuthor.trim() : formAuthor.trim()) || isSubmitting}
                className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs rounded transition-all duration-200 shadow-md"
              >
                {isSubmitting ? '发布中...' : '📤 发布'}
              </button>
            </div>
          </div>
        )}

        <p className="text-amber-400/70 text-sm text-center py-4">暂无公告</p>
      </div>
    );
  }

  // 获取当前显示的公告（最多2条）
  const displayedAnnouncements = announcements.slice(currentIndex, currentIndex + 2);
  
  // 如果只有1条公告且总数大于1，补充下一条
  if (displayedAnnouncements.length === 1 && announcements.length > 1) {
    displayedAnnouncements.push(announcements[0]); // 循环到第一条
  }

  return (
    <div 
      className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border border-amber-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-4 mb-6"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-sm">📢</span>
          </div>
          <div>
            <h2 className="text-lg font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              公告中心
            </h2>
            <p className="text-amber-400/70 font-medium text-xs">发布和管理系统公告</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 发布按钮 */}
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-green-900/40 text-green-400 border border-green-700/50 px-2 py-1 rounded-full text-xs font-semibold hover:bg-green-800/40 transition-all duration-200"
          >
            + 发布
          </button>
          
          {/* 指示器 */}
          {announcements.length > 1 && (
            <div className="flex space-x-1">
              {Array.from({ length: announcements.length }).map((_, index) => (
                <div
                  key={index}
                  className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                    index === currentIndex ? 'bg-amber-400' : 'bg-amber-700/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 发布公告表单 */}
      {showAddForm && (
        <div className="mb-4 p-3 bg-gray-800/40 backdrop-blur-sm rounded-lg border border-amber-700/20">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-amber-400 text-sm font-medium">发布新公告</h4>
            <button
              onClick={cancelAdd}
              className="text-amber-400/70 hover:text-amber-400 text-sm"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            <div className="space-y-2">
              <select
                value={formAuthor}
                onChange={(e) => setFormAuthor(e.target.value)}
                className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-amber-700/30 focus:border-amber-600/50 focus:outline-none"
              >
                <option value="">选择发布人...</option>
                {availableNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value="custom">手动输入...</option>
              </select>
                      {formAuthor === 'custom' && (
                        <input
                          type="text"
                          value={customAuthor}
                          onChange={(e) => setCustomAuthor(e.target.value)}
                          placeholder="请输入发布人姓名..."
                          className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-amber-700/30 focus:border-amber-600/50 focus:outline-none"
                          maxLength={50}
                          autoFocus
                        />
                      )}
            </div>
            
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="输入公告内容..."
              className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-amber-700/30 focus:border-amber-600/50 focus:outline-none resize-none"
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-amber-400/70">{formContent.length}/500</span>
            <button
              onClick={handleAddAnnouncement}
              disabled={!formContent.trim() || !(formAuthor === 'custom' ? customAuthor.trim() : formAuthor.trim()) || isSubmitting}
              className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs rounded transition-all duration-200 shadow-md"
            >
              {isSubmitting ? '发布中...' : '📤 发布'}
            </button>
          </div>
        </div>
      )}

      {/* 公告内容区域 - 支持手动滚动和透明滚动条 */}
      <div className="relative">
        <div 
          ref={scrollContainerRef}
          className="max-h-20 overflow-y-auto announcement-scrollbar pr-2"
          onScroll={handleScroll}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(75, 85, 99, 0.6) rgba(31, 41, 55, 0.6)'
          }}
        >
          <div className="space-y-3">
            {displayedAnnouncements.map((announcement, index) => (
              <div 
                key={announcement.id}
                className="bg-gray-800/40 backdrop-blur-sm rounded-lg p-3 border-l-4 border-amber-500 group hover:bg-gray-800/60 transition-all duration-200"
              >
                {/* 编辑表单 */}
                {editingId === announcement.id ? (
                  <div className="space-y-2">
                    <div className="space-y-2">
                      <select
                        value={formAuthor}
                        onChange={(e) => setFormAuthor(e.target.value)}
                        className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-amber-700/30 focus:border-amber-600/50 focus:outline-none"
                      >
                        <option value="">选择发布人...</option>
                        {availableNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                        <option value="custom">手动输入...</option>
                      </select>
                      {formAuthor === 'custom' && (
                        <input
                          type="text"
                          value={customAuthor}
                          onChange={(e) => setCustomAuthor(e.target.value)}
                          placeholder="请输入发布人姓名..."
                          className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-amber-700/30 focus:border-amber-600/50 focus:outline-none"
                          maxLength={50}
                          autoFocus
                        />
                      )}
                    </div>
                    
                    <textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-amber-700/30 focus:border-amber-600/50 focus:outline-none resize-none"
                      rows={3}
                      maxLength={500}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-400/70">{formContent.length}/500</span>
                      <div className="flex space-x-2">
                        <button
                          onClick={cancelEdit}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors duration-200"
                        >
                          ❌ 取消
                        </button>
                        <button
                          onClick={() => handleEditAnnouncement(announcement.id)}
                          disabled={!formContent.trim() || !(formAuthor === 'custom' ? customAuthor.trim() : formAuthor.trim()) || isSubmitting}
                          className="px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs rounded transition-all duration-200"
                        >
                          {isSubmitting ? '保存中...' : '💾 保存'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 公告内容 */}
                    <div className="flex items-start justify-between">
                      <p className="text-gray-200 text-sm leading-relaxed mb-2 flex-1 pr-2">
                        {announcement.content}
                      </p>
                      {/* 操作按钮 */}
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => startEdit(announcement)}
                          className="p-1 text-amber-400/70 hover:text-amber-400 hover:bg-amber-900/30 rounded transition-colors duration-200"
                          title="编辑"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(announcement.id)}
                          className="p-1 text-red-400/70 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors duration-200"
                          title="删除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {/* 发布人和时间戳 */}
                    <div className="flex items-center justify-between text-xs text-amber-400/70">
                      <div className="flex items-center">
                        <span className="mr-1">👤</span>
                        <span>{announcement.author || '匿名'}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="mr-1">🕒</span>
                        {new Date(announcement.created_at).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 滚动状态提示 */}
      <div className="text-center mt-2">
        {isPaused && (
          <span className="text-xs text-amber-500/70">⏸️ 已暂停自动播放</span>
        )}
        {isManualScrolling && (
          <span className="text-xs text-blue-400/70">📜 手动滚动中</span>
        )}
        {!isPaused && !isManualScrolling && announcements.length > 1 && (
          <span className="text-xs text-green-400/70">▶️ 自动播放中</span>
        )}
      </div>
    </div>
  );
}