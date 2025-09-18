interface Submission {
  duration?: string; // e.g. "MM:SS" or "HH:MM:SS"
}

interface Assignment {
  submissions?: Submission[];
}

/**
 * Calculate total practice time from multiple submissions
 * @param submissions - Array of submission objects with duration property
 * @returns Formatted total time (MM:SS or HH:MM:SS)
 */
export function calculateTotalPracticeTime(
  submissions: Submission[] | null | undefined
): string {
  if (!submissions || submissions.length === 0) {
    return "00:00";
  }

  const totalSeconds = submissions.reduce((sum, submission) => {
    const duration = submission.duration;
    if (duration) {
      const parts = duration.split(":");
      if (parts.length === 2) {
        // MM:SS format
        const minutes = parseInt(parts[0], 10) || 0;
        const seconds = parseInt(parts[1], 10) || 0;
        return sum + minutes * 60 + seconds;
      } else if (parts.length === 3) {
        // HH:MM:SS format
        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        const seconds = parseInt(parts[2], 10) || 0;
        return sum + hours * 3600 + minutes * 60 + seconds;
      }
    }
    return sum;
  }, 0);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  } else {
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }
}

/**
 * Calculate total practice time for a student across all assignments
 * @param assignments - Array of assignment objects with submissions
 * @returns Formatted total time (MM:SS or HH:MM:SS)
 */
export function calculateStudentTotalPracticeTime(
  assignments: Assignment[] | null | undefined
): string {
  if (!assignments || assignments.length === 0) {
    return "00:00";
  }

  const allSubmissions = assignments.reduce<Submission[]>((acc, assignment) => {
    if (assignment.submissions && assignment.submissions.length > 0) {
      acc.push(...assignment.submissions);
    }
    return acc;
  }, []);

  return calculateTotalPracticeTime(allSubmissions);
}
