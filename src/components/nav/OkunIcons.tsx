interface IconProps {
  size?: number
  className?: string
}

function navIcon(path: string) {
  const Ico = ({ size = 36, className }: IconProps) => (
    <img
      src={path}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
      draggable={false}
    />
  )
  return Ico
}

export const IcoDashboard           = navIcon('/icons/nav/ico-dashboard.png')
export const IcoMitarbeiter         = navIcon('/icons/nav/ico-mitarbeiter.png')
export const IcoDienstplanung       = navIcon('/icons/nav/ico-dienstplanung.png')
export const IcoZeitUrlaub          = navIcon('/icons/nav/ico-zeit-urlaub.png')
export const IcoFinanzen            = navIcon('/icons/nav/ico-finanzen.png')
export const IcoKIAnalyse           = navIcon('/icons/nav/ico-ki-analyse.png')
export const IcoEinstellungen       = navIcon('/icons/nav/ico-einstellungen.png')
export const IcoStandorte           = navIcon('/icons/nav/ico-standorte.png')
export const IcoSuche               = navIcon('/icons/nav/ico-suche.png')
export const IcoHeute               = navIcon('/icons/nav/ico-heute.png')
export const IcoDienstplanErstellen = navIcon('/icons/nav/ico-dienstplan-erstellen.png')
export const IcoKalender            = navIcon('/icons/nav/ico-kalender.png')
export const IcoUrlaubsantraege     = navIcon('/icons/nav/ico-urlaubsantraege.png')
export const IcoAufgaben            = navIcon('/icons/nav/ico-aufgaben.png')
export const IcoVertretungen        = navIcon('/icons/nav/ico-vertretungen.png')
export const IcoBerichte            = navIcon('/icons/nav/ico-berichte.png')
export const IcoWorkforceScore      = navIcon('/icons/nav/ico-workforce-score.png')
export const IcoPersonalrisiko      = navIcon('/icons/nav/ico-personalrisiko.png')
export const IcoSupport             = navIcon('/icons/nav/ico-support.png')
export const IcoMitarbeiterprofil   = navIcon('/icons/nav/ico-mitarbeiterprofil.png')
export const IcoLohnabrechnung      = navIcon('/icons/nav/ico-lohnabrechnung.png')
export const IcoZuschlagsEngine     = navIcon('/icons/nav/ico-zuschlags-engine.png')
export const IcoFairnessEngine      = navIcon('/icons/nav/ico-fairness-engine.png')
export const IcoKIOnboarding        = navIcon('/icons/nav/ico-ki-onboarding.png')
export const IcoOKUNAssistent       = navIcon('/icons/nav/ico-okun-assistent.png')
