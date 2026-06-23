import { z } from "zod";

export const EpisodeBriefSchema = z.object({
  episode_id: z.string(),
  arc_stage: z.string(),
  episode_function: z.string(),
  required_plot_point: z.string(),
  characters: z.array(z.string()),
  workplace_theme: z.string(),
  continuity_notes: z.array(z.string()),
  ending_state_change: z.string()
});

export type EpisodeBrief = z.infer<typeof EpisodeBriefSchema>;

export const NarrativeBibleSchema = z.object({
  updated_at: z.string(),
  series_metadata: z.object({
    total_seasons: z.number(),
    current_season: z.number()
  }),
  seasons: z.array(
    z.object({
      season_id: z.string(),
      title: z.string(),
      summary: z.string(),
      episodes: z.array(
        z.object({
          episode_id: z.string(),
          title: z.string(),
          workplace_theme: z.string(),
          summary: z.string(),
          golden_quotes: z.array(
            z.object({
              character_id: z.string(),
              quote: z.string()
            })
          )
        })
      )
    })
  ),
  characters: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      workplace_role: z.string(),
      image_evolution: z.string(),
      current_mindset: z.string(),
      dynamic_relationships: z.array(
        z.object({
          target_id: z.string(),
          relationship_state: z.string()
        })
      ),
      recent_memories: z.array(z.string())
    })
  )
});

export const NarrativeBibleUpdateSchema = z.object({
  updated_narrative_bible: NarrativeBibleSchema,
  continuity_warnings: z.array(z.string())
});

export type NarrativeBible = z.infer<typeof NarrativeBibleSchema>;
export type NarrativeBibleUpdate = z.infer<typeof NarrativeBibleUpdateSchema>;
