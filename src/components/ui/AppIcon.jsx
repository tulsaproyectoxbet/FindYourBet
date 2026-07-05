// Icones de la UI. Sempre usem aquest component — mai emojis directes al codi.
// Afegir nous noms aquí per mantenir coherència entre totes les vistes.
import {
  Trophy, Flame, Target, Star, Crown, Shield, ShieldCheck, Award,
  Users, User, Bell, BellOff, Search, MessageSquare, MessageCircle,
  Mail, FileText, Calendar, PieChart, TrendingUp, Clock, Bookmark,
  Send, Filter, SlidersHorizontal, Lock, Unlock, Globe, Camera,
  Trash2, Pencil, Pin, Flag, Ban, Link, Eye, EyeOff, Loader2,
  AlertTriangle, Check, X, Copy, Share2, LogOut, Settings, Phone,
  Lightbulb, Gem, Paperclip, Megaphone, RefreshCw, BarChart3, BarChart2,
  ClipboardList, Radio, Upload, Mic, Plus, Minus, Heart, ThumbsUp,
  CheckCircle, XCircle, HelpCircle, Info, Pencil as PencilIcon,
  ChevronDown, ChevronRight, ArrowUpRight, Shuffle, Headphones,
  DoorOpen, Image, BarChart, Rss, Dices, Vote, Smile, MapPin,
  Antenna, AlarmClock, BookOpen, ListChecks, Zap, ArrowRight,
  MoreHorizontal, ExternalLink, Layers, Hash, AtSign, Siren, CreditCard, CornerDownLeft, Folder,
} from 'lucide-react'

// ── Mapa canònic: nom semàntic → icona Lucide ─────────────────────────────
// Quan necesitis afegir una icona nova, afegeix-la aquí i usa el nom al JSX.
const ICON_MAP = {
  // ── Sidebar nav ──────────────────────────────────────────────────────────
  user:          User,
  users:         Users,
  stats:         BarChart3,
  historial:     ClipboardList,
  social:        MessageSquare,
  canales:       Radio,
  feed:          Flame,
  tipsters:      Target,
  ranking:       Trophy,
  rankingAmigos: Users,
  faqs:          HelpCircle,
  contacto:      Headphones,
  sugerencias:   Lightbulb,
  settings:      Settings,
  admin:         ShieldCheck,
  newbet:        Plus,
  configuracion: Settings,

  // ── Accions generals ─────────────────────────────────────────────────────
  edit:          Pencil,
  delete:        Trash2,
  share:         Share2,
  copy:          Copy,
  send:          Send,
  upload:        Upload,
  refresh:       RefreshCw,
  leave:         LogOut,
  filter:        Filter,
  sliders:       SlidersHorizontal,
  search:        Search,
  plus:          Plus,
  minus:         Minus,
  check:         Check,
  close:         X,
  info:          Info,
  chevronDown:   ChevronDown,
  chevronRight:  ChevronRight,
  arrowOut:      ArrowUpRight,
  arrowRight:    ArrowRight,
  externalLink:  ExternalLink,
  more:          MoreHorizontal,
  shuffle:       Shuffle,
  door:          DoorOpen,
  image:         Image,
  map:           MapPin,
  layers:        Layers,
  hash:          Hash,
  at:            AtSign,
  zap:           Zap,

  // ── Estat / Status ───────────────────────────────────────────────────────
  loading:       Loader2,
  warning:       AlertTriangle,
  success:       CheckCircle,
  error:         XCircle,
  alarm:         AlarmClock,

  // ── Icones principals ────────────────────────────────────────────────────
  trophy:        Trophy,
  flame:         Flame,
  fire:          Flame,
  star:          Star,
  crown:         Crown,
  shield:        Shield,
  shieldCheck:   ShieldCheck,
  award:         Award,
  medal:         Award,
  gem:           Gem,
  listChecks:    ListChecks,

  // ── Social ────────────────────────────────────────────────────────────────
  bell:          Bell,
  bellOff:       BellOff,
  heart:         Heart,
  thumbsUp:      ThumbsUp,
  message:       MessageSquare,
  messageCircle: MessageCircle,
  mail:          Mail,
  flag:          Flag,
  ban:           Ban,
  smile:         Smile,
  megaphone:     Megaphone,

  // ── Contingut ─────────────────────────────────────────────────────────────
  document:      FileText,
  calendar:      Calendar,
  pieChart:      PieChart,
  trendingUp:    TrendingUp,
  barChart:      BarChart3,
  barChart2:     BarChart2,
  clock:         Clock,
  bookmark:      Bookmark,
  paperclip:     Paperclip,
  mic:           Mic,
  vote:          Vote,
  bookOpen:      BookOpen,
  rss:           Rss,

  // ── UI / seguretat ────────────────────────────────────────────────────────
  lock:          Lock,
  unlock:        Unlock,
  globe:         Globe,
  camera:        Camera,
  pin:           Pin,
  link:          Link,
  eye:           Eye,
  eyeOff:        EyeOff,
  phone:         Phone,
  lightbulb:     Lightbulb,
  radio:         Radio,
  antenna:       Radio,
  creditCard:    CreditCard,
  reply:         CornerDownLeft,
  folder:        Folder,
}

// ── Component ─────────────────────────────────────────────────────────────
export default function AppIcon({ name, size = 16, color, strokeWidth, style, className }) {
  const Icon = ICON_MAP[name]
  if (!Icon) return null
  return (
    <Icon
      size={size}
      color={color || 'currentColor'}
      strokeWidth={strokeWidth ?? 2}
      style={style}
      className={className}
    />
  )
}

export { ICON_MAP }
