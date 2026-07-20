import grandessaIdentity from "../../config/grandessaIdentity";
import grandessaTheme from "../../config/grandessaTheme";

export default function StatusWidget() {
  return (
    <section
      style={{
        background: grandessaIdentity.branding.cardColor,
        borderRadius: grandessaTheme.borderRadius,
        padding: grandessaTheme.spacing.lg,
        boxShadow: grandessaTheme.shadow,
        marginBottom: grandessaTheme.spacing.lg,
      }}
    >
      <h3
        style={{
          marginTop: 0,
          color: grandessaIdentity.branding.primaryColor,
        }}
      >
        Daily Status
      </h3>

      <p
        style={{
          marginBottom: 0,
          color: "#555",
        }}
      >
        {grandessaIdentity.status.allGood}
      </p>
    </section>
  );
}