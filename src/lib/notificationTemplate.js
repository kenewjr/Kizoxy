// Shared notification-message templating for YouTube + TikTok announcements.
// Lets a subscription carry a custom message with {placeholders}, falling back
// to the subsystem's default prefix when no custom message is set.
//
// Supported placeholders (missing/unknown ones render as empty string):
//   {role}  -> the mention-role ping (<@&id>) or "" if none
//   {name}  -> creator / channel name
//   {url}   -> the content URL (video / live / short)
//   {title} -> the content title
//   {type}  -> the classification label (video / short / live / upcoming)

const MAX_CONTENT = 2000; // Discord message content hard limit.

function renderTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_m, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : "",
  );
}

// Build the final message content string (or undefined for no content).
//   customMessage : user's template, or null/"" to use defaultPrefix
//   mentionRoleId : role to ping, or null
//   defaultPrefix : the built-in text used when customMessage is empty
//   vars          : placeholder values (name/url/title/type)
function buildContent({
  customMessage,
  mentionRoleId,
  defaultPrefix,
  vars = {},
}) {
  const roleMention = mentionRoleId ? `<@&${mentionRoleId}>` : "";
  const merged = { ...vars, role: roleMention };

  let out;
  if (customMessage && String(customMessage).trim()) {
    out = renderTemplate(customMessage, merged);
    // If the template never referenced {role}, prepend the ping so a set
    // mention role is still honoured.
    if (roleMention && !/\{role\}/.test(customMessage)) {
      out = `${roleMention} ${out}`;
    }
  } else {
    out = roleMention ? `${roleMention} ${defaultPrefix}` : defaultPrefix;
  }

  out = out.trim();
  if (out.length > MAX_CONTENT) out = out.slice(0, MAX_CONTENT);
  return out || undefined;
}

module.exports = { renderTemplate, buildContent, MAX_CONTENT };
