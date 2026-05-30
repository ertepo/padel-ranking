const DEFAULT_API_BASE_URL = 'https://openresa.com/api/v1';
const DEFAULT_BOOKING_URL = 'https://openresa.com/tiebreak';

type JsonRecord = Record<string, unknown>;

export type PublicCourt = {
  id: string;
  name: string;
  sport: 'padel' | 'tennis' | 'altro';
  color: string;
  surface: string | null;
  inoutdoor: string;
  closureLabel: string | null;
};

export type PublicSlot = {
  id: string;
  courtId: string;
  start: string;
  end: string;
  available: boolean;
  status: 'available' | 'booked' | 'closed' | 'closed_slot';
};

export type PublicAvailability = {
  bookingUrl: string;
  courts: PublicCourt[];
  slots: PublicSlot[];
  demo?: boolean;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' ? value as JsonRecord : null;
}

function unwrapList(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;

  const record = asRecord(payload);
  if (!record) return [];

  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }

  const data = asRecord(record.data);
  if (data) {
    for (const key of keys) {
      if (Array.isArray(data[key])) return data[key] as unknown[];
    }
  }

  return Array.isArray(record.data) ? record.data : [];
}

function stringValue(record: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }

  return '';
}

function sportFromName(name: string): PublicCourt['sport'] {
  const normalized = name.toLowerCase();
  if (normalized.includes('padel')) return 'padel';
  if (normalized.includes('tennis')) return 'tennis';
  return 'altro';
}

function isAvailable(record: JsonRecord): boolean {
  if (typeof record.available === 'boolean') return record.available;
  if (typeof record.is_available === 'boolean') return record.is_available;
  if (typeof record.bookable === 'boolean') return record.bookable;

  const status = stringValue(record, ['status', 'state']).toLowerCase();
  return ['available', 'free', 'open', 'libero', 'disponibile'].includes(status);
}

function normalizeTime(value: string, date: string): string {
  if (!value) return '';
  if (value.includes('T')) return value;
  if (value.includes(' ')) return value.replace(' ', 'T');
  return `${date}T${value}`;
}

export function normalizeAvailability(
  calendarsPayload: unknown,
  slotsPayload: unknown,
  date: string,
): PublicAvailability {
  const courts = unwrapList(calendarsPayload, ['calendars', 'items', 'results'])
    .map(asRecord)
    .filter((calendar): calendar is JsonRecord => Boolean(calendar))
    .map((calendar) => {
      const name = stringValue(calendar, ['calendar_name', 'name', 'title', 'label']);
      return {
        id: stringValue(calendar, ['id', 'calendar_id', 'uuid']),
        name,
        sport: sportFromName(name),
        color: stringValue(calendar, ['calendar_color', 'color']),
        surface: stringValue(calendar, ['surface']) || null,
        inoutdoor: stringValue(calendar, ['inoutdoor']),
        closureLabel: stringValue(calendar, ['closure_label']) || null,
      };
    })
    .filter((court) => court.id && court.name);

  const slotCalendars = unwrapList(slotsPayload, ['calendars']);
  const nestedSlots = slotCalendars.flatMap((calendar) => {
    const record = asRecord(calendar);
    return record ? unwrapList(record, ['slots']) : [];
  });
  const slots = (nestedSlots.length ? nestedSlots : unwrapList(slotsPayload, ['slots', 'items', 'results']))
    .map(asRecord)
    .filter((slot): slot is JsonRecord => Boolean(slot))
    .map((slot, index) => {
      const calendar = asRecord(slot.calendar);
      const courtId = stringValue(slot, ['calendar_id', 'calendarId', 'court_id'])
        || (calendar ? stringValue(calendar, ['id', 'calendar_id']) : '');
      const start = normalizeTime(stringValue(slot, ['date_start', 'start', 'start_at', 'starts_at', 'from']), date);
      const end = normalizeTime(stringValue(slot, ['date_end', 'end', 'end_at', 'ends_at', 'to']), date);
      const status = stringValue(slot, ['status']) as PublicSlot['status'];

      return {
        id: stringValue(slot, ['id', 'slot_id', 'uuid']) || `${courtId}-${start}-${index}`,
        courtId,
        start,
        end,
        available: isAvailable(slot),
        status: status || (isAvailable(slot) ? 'available' : 'booked'),
      };
    })
    .filter((slot) => slot.courtId && slot.start && slot.end);

  return {
    bookingUrl: DEFAULT_BOOKING_URL,
    courts,
    slots,
  };
}

function createDemoSlots(date: string, courtId: string, busyHours: number[]): PublicSlot[] {
  return Array.from({ length: 14 }, (_, index) => {
    const hour = index + 8;
    const start = `${date}T${String(hour).padStart(2, '0')}:00:00`;
    const end = `${date}T${String(hour + 1).padStart(2, '0')}:00:00`;

    return {
      id: `${courtId}-${hour}`,
      courtId,
      start,
      end,
      available: !busyHours.includes(hour),
      status: busyHours.includes(hour) ? 'booked' : 'available',
    };
  });
}

export function createDemoAvailability(date: string): PublicAvailability {
  const courts: PublicCourt[] = [
    { id: 'padel-1', name: 'Campo Padel', sport: 'padel', color: '#005ad8', surface: null, inoutdoor: 'outdoor', closureLabel: null },
    { id: 'tennis-1', name: 'Campo Tennis', sport: 'tennis', color: '#318a5d', surface: 'Terra battuta', inoutdoor: 'outdoor', closureLabel: null },
  ];

  return {
    bookingUrl: DEFAULT_BOOKING_URL,
    courts,
    slots: [
      ...createDemoSlots(date, 'padel-1', [10, 11, 16, 19]),
      ...createDemoSlots(date, 'tennis-1', [9, 14, 15, 20]),
    ],
    demo: true,
  };
}

export async function fetchOpenResaAvailability(date: string): Promise<PublicAvailability> {
  const token = import.meta.env.OPENRESA_API_TOKEN;
  if (!token) return createDemoAvailability(date);

  const apiBaseUrl = DEFAULT_API_BASE_URL;
  const headers = {
    Accept: 'application/json',
    'X-API-Key': token,
  };

  const [calendarsResponse, slotsResponse] = await Promise.all([
    fetch(`${apiBaseUrl}/calendars`, { headers }),
    fetch(`${apiBaseUrl}/slots?date=${encodeURIComponent(date)}`, { headers }),
  ]);

  if (!calendarsResponse.ok || !slotsResponse.ok) {
    throw new Error(`OpenResa API error (${calendarsResponse.status}/${slotsResponse.status})`);
  }

  return normalizeAvailability(
    await calendarsResponse.json(),
    await slotsResponse.json(),
    date,
  );
}
