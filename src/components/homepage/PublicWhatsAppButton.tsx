const PHONE_NUMBER = "2348186739390";
const DEFAULT_MESSAGE = "Hello Grandessa School. I would like to enquire about admission for my child.";

const whatsappUrl = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

export default function PublicWhatsAppButton() {
  return (
    <a
      className="homepage-whatsapp-fab"
      href={whatsappUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with Grandessa School on WhatsApp"
      title="Chat with Admissions on WhatsApp"
    >
      <span className="homepage-whatsapp-fab__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="img" focusable="false">
          <path
            fill="currentColor"
            d="M12.04 2C6.56 2 2.1 6.43 2.1 11.9c0 1.75.46 3.45 1.34 4.95L2 22l5.3-1.4a9.94 9.94 0 0 0 4.74 1.2h.01c5.47 0 9.95-4.44 9.95-9.9S17.52 2 12.04 2Zm5.78 14.03c-.24.68-1.4 1.3-1.95 1.39-.5.08-1.12.12-1.82-.1-.42-.13-.96-.32-1.66-.62-2.92-1.26-4.82-4.22-4.96-4.42-.13-.2-1.19-1.58-1.19-3 0-1.42.74-2.12 1-2.41.26-.3.57-.37.75-.37h.54c.17 0 .4-.06.62.45.24.57.82 1.97.9 2.11.07.14.12.3.02.49-.1.2-.15.31-.3.47-.15.16-.31.36-.44.48-.15.15-.31.31-.13.62.18.31.8 1.33 1.71 2.15 1.18 1.06 2.17 1.39 2.48 1.55.31.16.49.14.68-.08.19-.22.8-.93 1.02-1.25.22-.31.43-.26.72-.16.3.1 1.86.87 2.18 1.03.31.16.52.24.6.37.07.13.07.77-.17 1.45Z"
          />
        </svg>
      </span>
      <span className="homepage-whatsapp-fab__text">WhatsApp Admissions</span>
    </a>
  );
}
