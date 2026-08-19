import {
  LayoutDashboard, Users, CalendarDays, Clock, DollarSign,
  Sparkles, Settings, MapPin, Search, Sun, CalendarPlus,
  Calendar, CalendarX, CheckSquare, Repeat, BarChart2,
  TrendingUp, ShieldAlert, HelpCircle, UserCircle, Receipt,
  Percent, Scale, Bot, MessageCircleQuestion, BarChart3,
} from 'lucide-react'

interface IconProps {
  size?: number
  className?: string
}

function navIcon(LIcon: React.FC<any>, color = 'rgba(255,255,255,0.82)') { // any: lucide ForwardRefExoticComponent
  const Ico = ({ size = 40, className }: IconProps) => (
    <LIcon size={22} strokeWidth={1.6} color={color} className={className} />
  )
  return Ico
}

const gold = 'rgba(200,156,91,0.95)'

export const IcoDashboard           = navIcon(LayoutDashboard)
export const IcoMitarbeiter         = navIcon(Users)
export const IcoDienstplanung       = navIcon(CalendarDays)
export const IcoZeitUrlaub          = navIcon(Clock)
export const IcoFinanzen            = navIcon(DollarSign)
export const IcoKIAnalyse           = navIcon(BarChart3)
export const IcoEinstellungen       = navIcon(Settings)
export const IcoStandorte           = navIcon(MapPin)
export const IcoSuche               = navIcon(Search)
export const IcoHeute               = navIcon(Sun)
export const IcoDienstplanErstellen = navIcon(CalendarPlus)
export const IcoKalender            = navIcon(Calendar)
export const IcoUrlaubsantraege     = navIcon(CalendarX)
export const IcoAufgaben            = navIcon(CheckSquare)
export const IcoVertretungen        = navIcon(Repeat)
export const IcoBerichte            = navIcon(BarChart2)
export const IcoWorkforceScore      = navIcon(TrendingUp)
export const IcoPersonalrisiko      = navIcon(ShieldAlert)
export const IcoSupport             = navIcon(HelpCircle)
export const IcoMitarbeiterprofil   = navIcon(UserCircle)
export const IcoLohnabrechnung      = navIcon(Receipt)
export const IcoZuschlagsEngine     = navIcon(Percent)
export const IcoFairnessEngine      = navIcon(Scale)
export const IcoKIOnboarding        = navIcon(Bot)
// §106 Eigenes Icon: der Assistent hatte denselben goldenen Stern wie
// die Auswertungen — zwei Menuepunkte, ein Symbol.
export const IcoOKUNAssistent       = navIcon(MessageCircleQuestion, gold)
