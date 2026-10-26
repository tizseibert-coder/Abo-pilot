import { visibleOffers } from './offers';
import type { OfferContext } from './overview';
import { getProfile } from './repo';
import type { User } from './repo';

/** Angebote und Profil für die Berechnungen einer Nutzerin oder eines Nutzers. */
export function offerContext(userId: number): OfferContext {
  return { offersFor: (category) => visibleOffers(category), profile: getProfile(userId) };
}

export function isAdmin(user: Pick<User, 'email'> | null): boolean {
  if (!user) return false;
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}
