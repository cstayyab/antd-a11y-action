// Stand-in for @fortawesome/react-fontawesome, which this fixture doesn't install.
export function FontAwesomeIcon({ icon, title }: { icon: string; title?: string }) {
  return <svg aria-hidden={title ? undefined : true} data-icon={icon}>{title ? <title>{title}</title> : null}</svg>;
}
