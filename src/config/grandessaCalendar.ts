export type ReportTerm = "First" | "Second" | "Third";

export interface TermCalendarConfig {
	startDate: string;
	endDate: string;
	termEnding: string;
	nextTermBegins: string;
}

export interface AcademicCalendarConfig {
	academicYear: string;
	firstTerm: TermCalendarConfig;
	secondTerm: TermCalendarConfig;
	thirdTerm: TermCalendarConfig;
}

function getCurrentAcademicYear(): string {
	const now = new Date();
	const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

	return `${year}/${year + 1}`;
}

export const defaultAcademicCalendar: AcademicCalendarConfig = {
	academicYear: getCurrentAcademicYear(),
	firstTerm: {
		startDate: `${getCurrentAcademicYear().slice(0, 4)}-09-01`,
		endDate: `${getCurrentAcademicYear().slice(0, 4)}-12-15`,
		termEnding: `${getCurrentAcademicYear().slice(0, 4)}-12-15`,
		nextTermBegins: `${Number(getCurrentAcademicYear().slice(5))}-01-08`,
	},
	secondTerm: {
		startDate: `${Number(getCurrentAcademicYear().slice(5))}-01-08`,
		endDate: `${Number(getCurrentAcademicYear().slice(5))}-04-12`,
		termEnding: `${Number(getCurrentAcademicYear().slice(5))}-04-12`,
		nextTermBegins: `${Number(getCurrentAcademicYear().slice(5))}-04-29`,
	},
	thirdTerm: {
		startDate: `${Number(getCurrentAcademicYear().slice(5))}-04-29`,
		endDate: `${Number(getCurrentAcademicYear().slice(5))}-07-26`,
		termEnding: `${Number(getCurrentAcademicYear().slice(5))}-07-26`,
		nextTermBegins: `${Number(getCurrentAcademicYear().slice(5))}-09-09`,
	},
};

export function getCalendarTermConfig(calendar: AcademicCalendarConfig, term: ReportTerm): TermCalendarConfig {
	if (term === "First") return calendar.firstTerm;
	if (term === "Second") return calendar.secondTerm;
	return calendar.thirdTerm;
}
