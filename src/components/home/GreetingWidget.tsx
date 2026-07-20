import grandessaIdentity from "../../config/grandessaIdentity";
import grandessaTheme from "../../config/grandessaTheme";

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return grandessaIdentity.greetings.morning;
  if (hour < 17) return grandessaIdentity.greetings.afternoon;

  return grandessaIdentity.greetings.evening;
}

export default function GreetingWidget() {
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
      <h2
        style={{
          margin: 0,
          fontFamily: "Fredoka",
          fontSize: "2rem",
          color: grandessaIdentity.branding.primaryColor,
        }}
      >
        {getGreeting()}
      </h2>

      <p
        style={{
          marginTop: "12px",
          marginBottom: "10px",
          fontFamily: "Poppins",
          fontSize: "1.3rem",
          fontWeight: 600,
          color: "#243424",
        }}
      >
        Ready for another amazing school day?
      </p>

      <p
        style={{
          margin: 0,
          color: "#667085",
          lineHeight: 1.8,
          fontSize: "1rem",
        }}
      >
        Every child deserves a place where they can learn, grow and shine.
        Let's make today wonderful together.
      </p>
    </section>
  );
}