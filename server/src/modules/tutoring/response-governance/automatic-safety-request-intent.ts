const ANSWER_KEY_DELIVERY_REQUEST =
  /\b(?:access|give|obtain|provide|reveal|see|send|share|show)\b.{0,60}\b(?:the\s+)?answer\s+key\b|\b(?:the\s+)?answer\s+key\b.{0,60}\b(?:access|give|obtain|provide|reveal|see|send|share|show)\b/iu
const OFFICIAL_SOLUTION_DELIVERY_REQUEST =
  /\b(?:access|give|obtain|provide|reveal|see|send|share|show)\b.{0,60}\b(?:(?:all|the)\s+)?(?:official|instructor|model)\s+(?:answers?|solutions?)\b|\b(?:official|instructor|model)\s+(?:answers?|solutions?)\b.{0,60}\b(?:access|give|obtain|provide|reveal|see|send|share|show)\b/iu
const OBFUSCATED_DELIVERY_REQUEST =
  /\b(?:hide|conceal|disguise|embed|encode|place|put|wrap)\b.{0,100}\b(?:answer|code|implementation|solution)\b.{0,80}\b(?:comments?|details|html|markdown|base64|rot13|spoiler)\b|\b(?:answer|code|implementation|solution)\b.{0,80}\b(?:comments?|details|html|markdown|base64|rot13|spoiler)\b/iu
const SAFETY_DISCUSSION =
  /\b(?:analy[sz]e|describe|discuss|explain|teach)\b.{0,160}\b(?:acceptable|danger|dangerous|policy|risk|risky|safe|safety|unacceptable|unsafe)\b/iu
const MIXED_SAFETY_DELIVERY_REQUEST =
  /(?:\b(?:also|and(?:\s+then)?|but|then)\b|[.;!?])[^\n]{0,100}\b(?:access|build|code|complete|give|hide|implement|obtain|place|provide|put|reveal|see|send|share|show|solve|write)\b[^\n]{0,100}\b(?:answer\s+key|answers?|code|implementation|official\s+(?:answers?|solutions?)|program|solution)\b/iu

export function requestsProtectedSolution(content: string): boolean {
  return (
    ANSWER_KEY_DELIVERY_REQUEST.test(content) ||
    OFFICIAL_SOLUTION_DELIVERY_REQUEST.test(content)
  )
}

export function requestsObfuscatedDeliverable(content: string): boolean {
  return OBFUSCATED_DELIVERY_REQUEST.test(content)
}

export function isSafetyDiscussion(content: string): boolean {
  return (
    SAFETY_DISCUSSION.test(content) &&
    !MIXED_SAFETY_DELIVERY_REQUEST.test(content)
  )
}
