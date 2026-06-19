export const getWhitelabelConfig = (req, res) => {
  const clientName = process.env.CLIENT_NAME || 'Swarm Agentic Lab';
  const primaryColor = process.env.THEME_PRIMARY || '#3b82f6';
  const accentColor = process.env.THEME_ACCENT || '#10b981';
  const logoUrl = process.env.LOGO_URL || '/favicon.svg';
  const rawAgents = process.env.ENABLED_AGENTS || 'DEVOPS_GENI,BI,LINA,NOVA,ASTRA,REHEARSAL,SEVA,MARTECH,OCTANE,AIVYUH,SHOPPE';
  const enabledAgents = rawAgents.split(',').map(s => s.trim().toUpperCase());

  res.json({
    clientName,
    theme: {
      primary: primaryColor,
      accent: accentColor,
      logo: logoUrl
    },
    enabledAgents
  });
};
