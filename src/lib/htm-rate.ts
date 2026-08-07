interface HtmSchedule {
  htm?: number | null;
  htmInsidentil?: number | null;
}

interface HtmMember {
  memberType?: string | null;
}

export function isInsidentil(member: HtmMember | null | undefined): boolean {
  return member?.memberType === "insidentil";
}

export function getHtmRate(schedule: HtmSchedule, member: HtmMember | null | undefined): number {
  if (isInsidentil(member)) return schedule.htmInsidentil ?? schedule.htm ?? 0;
  return schedule.htm ?? 0;
}