export default function PillFilter({ people, categories, selectedPeople, selectedCats, onTogglePerson, onToggleCat }) {
  const pillBase = {
    borderRadius: 99,
    fontSize: 11,
    padding: "3px 10px",
    border: "1px solid",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all .15s",
    whiteSpace: "nowrap",
  };

  const allSelected = selectedPeople.length === 0;
  const activeCats = categories.filter(c => c.count > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Row 1: People */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {/* "Todos" pill */}
        <button
          onClick={() => {
            // Deselect all people
            if (!allSelected) {
              selectedPeople.forEach(id => onTogglePerson(id));
            }
          }}
          style={{
            ...pillBase,
            background: allSelected ? "rgba(167,139,250,0.15)" : "rgba(128,128,128,0.08)",
            borderColor: allSelected ? "rgba(167,139,250,0.4)" : "rgba(128,128,128,0.2)",
            color: allSelected ? "#a78bfa" : "#8b7fa8",
          }}
        >
          Todos
        </button>

        {people.map(p => {
          const sel = selectedPeople.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => onTogglePerson(p.id)}
              style={{
                ...pillBase,
                background: sel ? `${p.color}20` : "rgba(128,128,128,0.08)",
                borderColor: sel ? `${p.color}50` : "rgba(128,128,128,0.2)",
                color: sel ? p.color : "#8b7fa8",
              }}
            >
              {p.label} ({p.count})
            </button>
          );
        })}
      </div>

      {/* Row 2: Categories (only if any have count > 0) */}
      {activeCats.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {activeCats.map(c => {
            const sel = selectedCats.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => onToggleCat(c.id)}
                style={{
                  ...pillBase,
                  background: sel ? `${c.color}20` : "rgba(128,128,128,0.08)",
                  borderColor: sel ? `${c.color}50` : "rgba(128,128,128,0.2)",
                  color: sel ? c.color : "#8b7fa8",
                }}
              >
                {c.icon} {c.label} ({c.count})
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
