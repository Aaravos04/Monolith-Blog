// tabs: [{ key, label, icon?, count? }]. count is hidden while it is undefined.
const Tabs = ({ tabs, active, onChange }) => (
  <div role="tablist" className="flex flex-wrap gap-x-6 border-b border-ink">
    {tabs.map(({ key, label, icon: Icon, count }) => {
      const isActive = key === active;
      return (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(key)}
          className={`-mb-px inline-flex items-center gap-2 border-b-2 px-1 py-2 text-sm ${
            isActive
              ? 'border-ink font-bold'
              : 'border-transparent text-muted hover:border-muted hover:text-ink'
          }`}
        >
          {Icon && <Icon size={16} aria-hidden="true" />}
          {label}
          {count !== undefined && <span className="text-xs">({count})</span>}
        </button>
      );
    })}
  </div>
);

export default Tabs;
