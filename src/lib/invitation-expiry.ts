export const INVITATION_VALID_DAYS = 7

export function invitationExpiry(): Date {
  return new Date(Date.now() + INVITATION_VALID_DAYS * 24 * 60 * 60 * 1000)
}
