import {
  Map, Users, ShoppingCart, Package, Factory, LayoutDashboard, Shield, Crown,
  Search, X, ChevronDown, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle2, ListChecks,
  Info, Tag, ArrowLeft, ArrowRight, BookOpen, Menu, ClipboardList, Warehouse, ScissorsSquare,
  Flame, PaintBucket, ShieldCheck, FileWarning, Link2, Copy, Check, Home, Compass,
  Command, CornerDownLeft, ArrowUp, ArrowDown, List, Circle, Clock, Sparkles, Target,
  type LucideIcon,
} from 'lucide-react';

/** Registry tên icon (string, dùng trong dữ liệu content) -> component lucide thật. */
export const GUIDE_ICONS: Record<string, LucideIcon> = {
  Route: Map,
  Map,
  Users,
  ShoppingCart,
  Package,
  Factory,
  LayoutDashboard,
  Shield,
  Crown,
  Warehouse,
  ClipboardList,
  ScissorsSquare,
  Flame,
  PaintBucket,
  ShieldCheck,
};

export function GuideIcon({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  const Cmp = GUIDE_ICONS[name] ?? BookOpen;
  return <Cmp size={size} color={color} />;
}

export {
  Search, X, ChevronDown, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle2, ListChecks,
  Info, Tag, ArrowLeft, ArrowRight, BookOpen, Menu, FileWarning, Link2, Copy, Check, Home, Compass,
  Command, CornerDownLeft, ArrowUp, ArrowDown, List, Circle, Clock, Sparkles, Target,
};
