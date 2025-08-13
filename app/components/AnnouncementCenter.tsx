'use client';

import { useState, useEffect, useRef } from 'react';

interface Comment {
  id: string;
  content: string;
  author: string;
  created_at: string;
}

interface Announcement {
  id: string;
  content: string;
  created_at: string;
  is_active: boolean;
  author?: string;
  type?: 'announcement' | 'message'; // 新增：区分公告和留言
  likes?: number; // 新增：点赞数
  comments?: Comment[]; // 新增：评论列表
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
  const [formType, setFormType] = useState<'announcement' | 'message'>('message');
  const [customAuthor, setCustomAuthor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableNames, setAvailableNames] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 生成多彩卡片样式
  const getCardStyle = (announcement: Announcement, index: number) => {
    if (announcement.type === 'announcement') {
      return 'bg-gradient-to-br from-amber-900/40 to-orange-900/40 border-l-4 border-amber-500 hover:from-amber-800/50 hover:to-orange-800/50';
    }
    
    const messageStyles = [
      'bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border-l-4 border-blue-500 hover:from-blue-800/50 hover:to-indigo-800/50',
      'bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-l-4 border-purple-500 hover:from-purple-800/50 hover:to-pink-800/50',
      'bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-l-4 border-green-500 hover:from-green-800/50 hover:to-emerald-800/50',
      'bg-gradient-to-br from-cyan-900/40 to-teal-900/40 border-l-4 border-cyan-500 hover:from-cyan-800/50 hover:to-teal-800/50',
      'bg-gradient-to-br from-rose-900/40 to-red-900/40 border-l-4 border-rose-500 hover:from-rose-800/50 hover:to-red-800/50',
      'bg-gradient-to-br from-violet-900/40 to-purple-900/40 border-l-4 border-violet-500 hover:from-violet-800/50 hover:to-purple-800/50'
    ];
    
    return messageStyles[index % messageStyles.length];
  };

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

  // 自动滚动逻辑 - 只在收起状态下启用
  useEffect(() => {
    if (announcements.length <= 1 || isPaused || isManualScrolling || isExpanded) {
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
  }, [announcements.length, isPaused, isManualScrolling, isExpanded]);

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
    const finalAuthor = formAuthor === 'custom' ? customAuthor.trim() : formAuthor.trim();
    if (!formContent.trim() || !finalAuthor || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: formContent.trim(), 
          author: finalAuthor,
          type: formType,
          is_active: true,
          likes: 0,
          comments: []
        })
      });
      
      if (res.ok) {
        setFormContent('');
        setFormAuthor('');
        setFormType('message');
        setCustomAuthor('');
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
          type: formType,
          is_active: true 
        })
      });
      
      if (res.ok) {
        // 找到被编辑公告在列表中的位置
        const editedIndex = announcements.findIndex(ann => ann.id === id);
        
        setFormContent('');
        setFormAuthor('');
        setFormType('message');
        setCustomAuthor('');
        setEditingId(null);
        
        // 立即更新数据
        await fetchAnnouncements();
        
        // 如果找到了被编辑的公告，将currentIndex设置为该公告的位置
        // 这样用户可以立即看到编辑结果
        if (editedIndex !== -1) {
          setCurrentIndex(editedIndex);
          // 暂停自动滚动2秒，让用户看到编辑结果
          setIsPaused(true);
          setTimeout(() => {
            setIsPaused(false);
          }, 2000);
        }
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
    setFormType(announcement.type || 'message');
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
    setFormType('message');
    setCustomAuthor('');
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    setFormContent('');
    setFormAuthor('');
    setFormType('message');
    setCustomAuthor('');
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border border-amber-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-4 mb-6">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-sm">💬</span>
          </div>
          <div className="w-16 h-4 bg-blue-600/30 rounded animate-pulse"></div>
        </div>
        <div className="space-y-3">
          <div className="w-full h-12 bg-amber-700/20 rounded animate-pulse"></div>
          <div className="w-full h-12 bg-amber-700/20 rounded animate-pulse"></div>
        </div>
      {/* 滚动状态提示 - 只在收起状态显示 */}
      {!isExpanded && (
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
      )}

    </div>
  );
}

  if (announcements.length === 0) {
    return (
      <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border border-amber-700/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl p-4 mb-6">
        {/* 标题栏 - 包含发布按钮 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white text-sm">💬</span>
            </div>
            <div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                家园留言板
              </h2>
              <p className="text-blue-400/70 font-medium text-xs">发布公告和分享留言</p>
            </div>
          </div>
          
        <div className="flex items-center space-x-2">
          {/* 展开/收起按钮 */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="bg-blue-900/40 text-blue-400 border border-blue-700/50 px-2 py-1 rounded-full text-xs font-semibold hover:bg-blue-800/40 transition-all duration-200"
          >
            {isExpanded ? '📄 收起' : '📋 展开'}
          </button>
          
          {/* 发布按钮 */}
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-green-900/40 text-green-400 border border-green-700/50 px-2 py-1 rounded-full text-xs font-semibold hover:bg-green-800/40 transition-all duration-200"
          >
            + 发布
          </button>
          
          {/* 指示器 - 只在收起状态显示 */}
          {!isExpanded && announcements.length > 1 && (
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
              <h4 className="text-blue-400 text-sm font-medium">发布新内容</h4>
              <button
                onClick={cancelAdd}
                className="text-blue-400/70 hover:text-blue-400 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {/* 类型选择 */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setFormType('announcement')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                    formType === 'announcement' 
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' 
                      : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'
                  }`}
                >
                  📢 公告
                </button>
                <button
                  onClick={() => setFormType('message')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                    formType === 'message' 
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                      : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'
                  }`}
                >
                  💬 留言
                </button>
              </div>
              
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
                placeholder={formType === 'announcement' ? "输入公告内容..." : "输入留言内容..."}
                className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-blue-700/30 focus:border-blue-600/50 focus:outline-none resize-none"
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-blue-400/70">{formContent.length}/500</span>
              <button
                onClick={handleAddAnnouncement}
                disabled={!formContent.trim() || !(formAuthor === 'custom' ? customAuthor.trim() : formAuthor.trim()) || isSubmitting}
                className={`px-3 py-1 text-white text-xs rounded transition-all duration-200 shadow-md ${
                  formType === 'announcement'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:bg-gray-700'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:bg-gray-700'
                } disabled:cursor-not-allowed`}
              >
                {isSubmitting ? '发布中...' : '📤 发布'}
              </button>
            </div>
          </div>
        )}

        <p className="text-blue-400/70 text-sm text-center py-4">暂无内容</p>
      </div>
    );
  }

  // 根据展开状态决定显示的公告
  const displayedAnnouncements = isExpanded 
    ? announcements // 展开时显示所有公告
    : announcements.slice(currentIndex, currentIndex + 2); // 收起时显示当前2条
  
  // 如果收起状态且只有1条公告且总数大于1，补充下一条
  if (!isExpanded && displayedAnnouncements.length === 1 && announcements.length > 1) {
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
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white text-sm">💬</span>
            </div>
            <div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                家园留言板
              </h2>
              <p className="text-blue-400/70 font-medium text-xs">发布公告和分享留言</p>
            </div>
          </div>
        
        <div className="flex items-center space-x-2">
          {/* 展开/收起按钮 */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="bg-blue-900/40 text-blue-400 border border-blue-700/50 px-2 py-1 rounded-full text-xs font-semibold hover:bg-blue-800/40 transition-all duration-200"
          >
            {isExpanded ? '📄 收起' : '📋 展开'}
          </button>
          
          {/* 发布按钮 */}
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-green-900/40 text-green-400 border border-green-700/50 px-2 py-1 rounded-full text-xs font-semibold hover:bg-green-800/40 transition-all duration-200"
          >
            + 发布
          </button>
          
          {/* 指示器 - 只在收起状态显示 */}
          {!isExpanded && announcements.length > 1 && (
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
        <div className="mb-4 p-3 bg-gray-800/40 backdrop-blur-sm rounded-lg border border-blue-700/20">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-blue-400 text-sm font-medium">发布新内容</h4>
            <button
              onClick={cancelAdd}
              className="text-blue-400/70 hover:text-blue-400 text-sm"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            {/* 类型选择 */}
            <div className="flex space-x-2">
              <button
                onClick={() => setFormType('announcement')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                  formType === 'announcement' 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' 
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'
                }`}
              >
                📢 公告
              </button>
              <button
                onClick={() => setFormType('message')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                  formType === 'message' 
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'
                }`}
              >
                💬 留言
              </button>
            </div>
            
            <div className="space-y-2">
              <select
                value={formAuthor}
                onChange={(e) => setFormAuthor(e.target.value)}
                className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-blue-700/30 focus:border-blue-600/50 focus:outline-none"
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
                          className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-blue-700/30 focus:border-blue-600/50 focus:outline-none"
                          maxLength={50}
                          autoFocus
                        />
                      )}
            </div>
            
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder={formType === 'announcement' ? "输入公告内容..." : "输入留言内容..."}
              className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-blue-700/30 focus:border-blue-600/50 focus:outline-none resize-none"
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-blue-400/70">{formContent.length}/500</span>
            <button
              onClick={handleAddAnnouncement}
              disabled={!formContent.trim() || !(formAuthor === 'custom' ? customAuthor.trim() : formAuthor.trim()) || isSubmitting}
              className={`px-3 py-1 text-white text-xs rounded transition-all duration-200 shadow-md ${
                formType === 'announcement'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:bg-gray-700'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:bg-gray-700'
              } disabled:cursor-not-allowed`}
            >
              {isSubmitting ? '发布中...' : '📤 发布'}
            </button>
          </div>
        </div>
      )}

      {/* 公告内容区域 - 根据展开状态调整高度 */}
      <div className="relative">
        <div 
          ref={scrollContainerRef}
          className={`${isExpanded ? 'max-h-96' : 'max-h-40'} overflow-y-auto announcement-scrollbar pr-2 transition-all duration-300`}
          onScroll={handleScroll}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(75, 85, 99, 0.6) rgba(31, 41, 55, 0.6)'
          }}
        >
          <div className={`${isExpanded ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}`}>
            {displayedAnnouncements.map((announcement, index) => (
              <div 
                key={announcement.id}
                className={`
                  ${getCardStyle(announcement, index)}
                  backdrop-blur-sm rounded-lg p-3 shadow-lg hover:shadow-xl transition-all duration-300
                  border border-white/10 hover:border-white/20
                `}
              >
                {/* 编辑表单 */}
                {editingId === announcement.id ? (
                  <div className="space-y-2">
                    {/* 类型选择 */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setFormType('announcement')}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                          formType === 'announcement' 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' 
                            : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'
                        }`}
                      >
                        📢 公告
                      </button>
                      <button
                        onClick={() => setFormType('message')}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                          formType === 'message' 
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                            : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'
                        }`}
                      >
                        💬 留言
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      <select
                        value={formAuthor}
                        onChange={(e) => setFormAuthor(e.target.value)}
                        className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-blue-700/30 focus:border-blue-600/50 focus:outline-none"
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
                          className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-blue-700/30 focus:border-blue-600/50 focus:outline-none"
                          maxLength={50}
                          autoFocus
                        />
                      )}
                    </div>
                    
                    <textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      placeholder={formType === 'announcement' ? "输入公告内容..." : "输入留言内容..."}
                      className="w-full p-2 bg-gray-800/50 text-gray-200 text-sm rounded border border-blue-700/30 focus:border-blue-600/50 focus:outline-none resize-none"
                      rows={3}
                      maxLength={500}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-400/70">{formContent.length}/500</span>
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
                          className={`px-2 py-1 text-white text-xs rounded transition-all duration-200 ${
                            formType === 'announcement'
                              ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:bg-gray-700'
                              : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:bg-gray-700'
                          } disabled:cursor-not-allowed`}
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
                      <div className="flex space-x-1 opacity-70 hover:opacity-100 transition-opacity duration-200">
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
                    {/* 类型标签 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          announcement.type === 'announcement'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                        }`}>
                          {announcement.type === 'announcement' ? '📢 公告' : '💬 留言'}
                        </span>
                      </div>
                    </div>

                    {/* 互动按钮 */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/announcements/like', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: announcement.id })
                              });
                              
                              if (res.ok) {
                                const data = await res.json();
                                // 乐观更新UI
                                setAnnouncements(prev => 
                                  prev.map(ann => 
                                    ann.id === announcement.id 
                                      ? { ...ann, likes: data.likes || (ann.likes || 0) + 1 }
                                      : ann
                                  )
                                );
                              }
                            } catch (error) {
                              console.error('点赞失败:', error);
                            }
                          }}
                          className="flex items-center space-x-1 text-xs text-gray-400 hover:text-red-400 transition-colors duration-200 hover:scale-110"
                        >
                          <span>❤️</span>
                          <span>{announcement.likes || 0}</span>
                        </button>
                        <button
                          onClick={() => {
                            setReplyingToId(replyingToId === announcement.id ? null : announcement.id);
                          }}
                          className="flex items-center space-x-1 text-xs text-gray-400 hover:text-blue-400 transition-colors duration-200"
                        >
                          <span>💬</span>
                          <span>{announcement.comments?.length || 0}</span>
                        </button>
                      </div>
                    </div>

                    {/* 发布人和时间戳 */}
                    <div className="flex items-center justify-between text-xs text-gray-400/70 mt-2">
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

                    {/* 回复表单 */}
                    {replyingToId === announcement.id && (
                      <div className="mt-3 p-2 bg-gray-900/50 rounded-lg border border-gray-700/50">
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={commentAuthor}
                            onChange={(e) => setCommentAuthor(e.target.value)}
                            placeholder="输入您的姓名..."
                            className="w-full p-2 bg-gray-800/50 text-gray-200 text-xs rounded border border-gray-700/30 focus:border-blue-600/50 focus:outline-none"
                            maxLength={50}
                          />
                          <textarea
                            value={commentContent}
                            onChange={(e) => setCommentContent(e.target.value)}
                            placeholder="写下您的回复..."
                            className="w-full p-2 bg-gray-800/50 text-gray-200 text-xs rounded border border-gray-700/30 focus:border-blue-600/50 focus:outline-none resize-none"
                            rows={2}
                            maxLength={200}
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">{commentContent.length}/200</span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  setReplyingToId(null);
                                  setCommentContent('');
                                  setCommentAuthor('');
                                }}
                                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors duration-200"
                              >
                                取消
                              </button>
                              <button
                                onClick={async () => {
                                  if (!commentContent.trim() || !commentAuthor.trim()) return;
                                  
                                  try {
                                    const res = await fetch('/api/announcements/comment', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ 
                                        postId: announcement.id, 
                                        content: commentContent.trim(), 
                                        author: commentAuthor.trim() 
                                      })
                                    });
                                    
                                    if (res.ok) {
                                      const data = await res.json();
                                      // 乐观更新UI
                                      setAnnouncements(prev => 
                                        prev.map(ann => 
                                          ann.id === announcement.id 
                                            ? { 
                                                ...ann, 
                                                comments: data.comment 
                                                  ? [...(ann.comments || []), data.comment]
                                                  : ann.comments || []
                                              }
                                            : ann
                                        )
                                      );
                                      
                                      setReplyingToId(null);
                                      setCommentContent('');
                                      setCommentAuthor('');
                                    } else {
                                      const errorData = await res.json();
                                      alert('回复失败: ' + (errorData.error || '未知错误'));
                                    }
                                  } catch (error) {
                                    console.error('回复失败:', error);
                                    alert('回复失败: ' + error);
                                  }
                                }}
                                disabled={!commentContent.trim() || !commentAuthor.trim()}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs rounded transition-colors duration-200"
                              >
                                回复
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 显示评论 */}
                    {announcement.comments && announcement.comments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {announcement.comments.map((comment) => (
                          <div key={comment.id} className="p-2 bg-gray-900/30 rounded border-l-2 border-gray-600">
                            <p className="text-gray-300 text-xs mb-1">{comment.content}</p>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>👤 {comment.author}</span>
                              <span>🕒 {new Date(comment.created_at).toLocaleString('zh-CN', {
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}