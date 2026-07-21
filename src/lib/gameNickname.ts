import type { SupabaseClient } from '@supabase/supabase-js';

// minuscolo, senza accenti, senza spazi/punteggiatura: "Mario Rossi" e
// "mario   rossì" normalizzano allo stesso valore
const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;

export function normalizeIdentity(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

type VerifyResult = { ok: true } | { ok: false; error: string };

const TAKEN_ERROR = 'Questo nickname è già stato scelto da un altro giocatore: provane un altro.';

/**
 * La prima volta che un nickname viene usato lo abbina al nome cognome
 * fornito; le volte successive controlla che combaci, per evitare che due
 * persone diverse rivendichino lo stesso nickname in classifica.
 */
export async function verifyOrClaimNickname(
  supabase: SupabaseClient,
  nickname: string,
  nomecognome: string,
): Promise<VerifyResult> {
  const nicknameNorm = normalizeIdentity(nickname);
  const nomecognomeNorm = normalizeIdentity(nomecognome);

  if (!nicknameNorm || !nomecognomeNorm) {
    return { ok: false, error: 'Nickname e nome cognome sono obbligatori.' };
  }

  const { data: existing, error: selectError } = await supabase
    .from('legends_game_players')
    .select('nomecognome_norm')
    .eq('nickname_norm', nicknameNorm)
    .maybeSingle();

  if (selectError) {
    return { ok: false, error: selectError.message };
  }

  if (existing) {
    return existing.nomecognome_norm === nomecognomeNorm
      ? { ok: true }
      : { ok: false, error: TAKEN_ERROR };
  }

  const { error: insertError } = await supabase
    .from('legends_game_players')
    .insert({ nickname_norm: nicknameNorm, nomecognome_norm: nomecognomeNorm });

  if (!insertError) {
    return { ok: true };
  }

  if (insertError.code === '23505') {
    // due richieste in contemporanea sullo stesso nickname: chi ha vinto la corsa?
    const { data: winner } = await supabase
      .from('legends_game_players')
      .select('nomecognome_norm')
      .eq('nickname_norm', nicknameNorm)
      .maybeSingle();

    return winner?.nomecognome_norm === nomecognomeNorm ? { ok: true } : { ok: false, error: TAKEN_ERROR };
  }

  return { ok: false, error: insertError.message };
}
