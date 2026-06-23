import { z } from "zod";

export const StoryboardShotSchema = z.object({
  shot_id: z.string(),
  camera_shot_type: z.string(),
  image_prompt: z.string(),
  action_description: z.string(),
  dialogue: z.string()
});

export const StoryboardSchema = z.object({
  episode_id: z.string(),
  generated_at: z.string(),
  shots: z.array(StoryboardShotSchema)
});

export const StoryboardReviewSchema = z.object({
  decision: z.enum(["pass", "revise"]),
  feedback: z.string(),
  violating_shot_ids: z.array(z.string()).optional()
});

export type StoryboardShot = z.infer<typeof StoryboardShotSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;
export type StoryboardReview = z.infer<typeof StoryboardReviewSchema>;
