"use client";
import { useAuth } from '../contexts/AuthContext';

interface PermissionWrapperProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  fallback?: React.ReactNode;
  className?: string;
}

export default function PermissionWrapper({
  children,
  adminOnly = false,
  fallback = null,
  className = ""
}: PermissionWrapperProps) {
  const { user, isAdmin } = useAuth();

  // 如果需要管理员权限但用户不是管理员
  if (adminOnly && !isAdmin) {
    if (fallback) {
      return <div className={className}>{fallback}</div>;
    }
    return null;
  }

  return <div className={className}>{children}</div>;
}

export function AdminOnly({
  children,
  fallback = null
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <PermissionWrapper adminOnly fallback={fallback}>
      {children}
    </PermissionWrapper>
  );
}

export function ReadOnlyWrapper({
  children,
  readOnlyComponent
}: {
  children: React.ReactNode;
  readOnlyComponent: React.ReactNode;
}) {
  const { isAdmin } = useAuth();

  return isAdmin ? <>{children}</> : <>{readOnlyComponent}</>;
}