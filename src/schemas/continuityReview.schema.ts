import { z } from "zod";

export const ContinuityReviewSchema = z.object({
  decision: z.enum(["pass", "revise", "reject"]),
  checks: z.object({
    connects_to_previous: z.boolean(),
    completes_episode_function: z.boolean(),
    relationship_logical: z.boolean(),
    no_major_conflicts: z.boolean()
  }),
  problems: z.array(z.string()),
  revision_notes: z.array(z.string())
});

export type ContinuityReview = z.infer<typeof ContinuityReviewSchema>;
