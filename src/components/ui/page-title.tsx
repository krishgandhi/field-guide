/**
 * The top of a tab screen: a big scoreboard title, one plain line under it,
 * and room on the right for an action (the flag count).
 */
export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-1 mt-2 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="heading text-[44px] text-chalk text-balance">{title}</h1>
        {subtitle ? (
          <p className="mt-1.5 text-[15px] text-chalk-dim">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
