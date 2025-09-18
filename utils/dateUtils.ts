/**
 * Parse date string with proper timezone handling
 * @param {string | Date | null | undefined} dateString - Date string or Date object
 * @returns {Date} - Parsed Date object
 */
function parseDateWithTimezone(
  dateString: string | Date | null | undefined
): Date {
  if (!dateString) {
    // Return a valid date for null/undefined to avoid throwing errors
    return new Date(0);
  }

  if (dateString instanceof Date) {
    return dateString;
  }

  const dateStr = String(dateString);

  // Handle empty or invalid strings
  if (!dateStr || dateStr.trim() === "") {
    return new Date(0);
  }

  let result: Date;

  // If no timezone info, assume UTC (backend sends UTC timestamps)
  if (
    !dateStr.includes("Z") &&
    !dateStr.includes("+") &&
    !dateStr.includes("-", 10)
  ) {
    result = new Date(dateStr + "Z");
  } else {
    result = new Date(dateStr);
  }

  // Check if the result is valid
  if (isNaN(result.getTime())) {
    return new Date(0);
  }

  return result;
}

/**
 * Format date and time consistently across the application
 * @param {string | Date} dateString - Date string or Date object
 * @param {string} [format='short'] - Format type: 'short', 'long', 'time', 'full', 'timeOnly', 'dateOnly'
 * @returns {string} - Formatted date string
 */
export function formatDateTime(
  dateString: string | Date | null | undefined,
  format: "short" | "long" | "time" | "full" | "timeOnly" | "dateOnly" = "short"
): string {
  if (!dateString || dateString === "N/A") return "N/A";

  let date: Date;
  try {
    date = parseDateWithTimezone(dateString);
  } catch {
    return "Invalid Date";
  }

  if (isNaN(date.getTime())) return "Invalid Date";

  switch (format) {
    case "short":
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    case "long":
      return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    case "time":
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    case "full":
      return date.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    case "timeOnly":
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    case "dateOnly":
      return date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
    default:
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  }
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 * @param {string | Date} dateString - Date string or Date object
 * @returns {string} - Relative time string
 */
export function formatRelativeTime(
  dateString: string | Date | null | undefined
): string {
  if (!dateString || dateString === "N/A") return "N/A";

  let date: Date;
  try {
    date = parseDateWithTimezone(dateString);
  } catch {
    return "Invalid Date";
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0) return "In the future";

  const intervals: { [unit: string]: number } = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(diffInSeconds / secondsInUnit);
    if (interval >= 1) {
      return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
    }
  }

  return "Just now";
}

/**
 * Check if a date is today
 * @param {string | Date} dateString - Date string or Date object
 * @returns {boolean} - True if date is today
 */
export function isToday(dateString: string | Date | null | undefined): boolean {
  if (!dateString) return false;

  let date: Date;
  try {
    date = parseDateWithTimezone(dateString);
  } catch {
    return false;
  }

  const today = new Date();

  return date.toDateString() === today.toDateString();
}

/**
 * Check if a date is yesterday
 * @param {string | Date} dateString - Date string or Date object
 * @returns {boolean} - True if date is yesterday
 */
export function isYesterday(
  dateString: string | Date | null | undefined
): boolean {
  if (!dateString) return false;

  let date: Date;
  try {
    date = parseDateWithTimezone(dateString);
  } catch {
    return false;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return date.toDateString() === yesterday.toDateString();
}

interface Submission {
  submittedAt: string | Date;
}

/**
 * Get the most recent date from an array of submissions
 * @param {Submission[]} submissions - Array of submission objects with submittedAt property
 * @param {string} [format='short'] - Format type for the date
 * @returns {string} - Formatted date of the most recent submission
 */
export function getLatestSubmissionDate(
  submissions: Submission[],
  format: "short" | "long" | "time" | "full" | "timeOnly" | "dateOnly" = "short"
): string {
  if (!submissions || submissions.length === 0) {
    return "No submissions";
  }

  const latestSubmission = submissions.reduce<Submission | null>(
    (latest, submission) => {
      const submissionDate = parseDateWithTimezone(submission.submittedAt);
      const latestDate = latest
        ? parseDateWithTimezone(latest.submittedAt)
        : new Date(0);

      return submissionDate > latestDate ? submission : latest;
    },
    null
  );

  return latestSubmission
    ? formatDateTime(latestSubmission.submittedAt, format)
    : "No submissions";
}

/**
 * Get the raw timestamp of the most recent submission
 * @param {Submission[]} submissions - Array of submission objects with submittedAt property
 * @returns {string | null} - Raw timestamp of the most recent submission, or null if no submissions
 */
export function getLatestSubmissionTimestamp(
  submissions: Submission[]
): string | null {
  if (!submissions || submissions.length === 0) {
    return null;
  }

  const latestSubmission = submissions.reduce<Submission | null>(
    (latest, submission) => {
      const submissionDate = parseDateWithTimezone(submission.submittedAt);
      const latestDate = latest
        ? parseDateWithTimezone(latest.submittedAt)
        : new Date(0);

      return submissionDate > latestDate ? submission : latest;
    },
    null
  );

  return latestSubmission ? String(latestSubmission.submittedAt) : null;
}
