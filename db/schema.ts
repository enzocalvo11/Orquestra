import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// The application stores proposed allocations; Azure DevOps remains the work-item source.
export const planChanges = sqliteTable("plan_changes", {
  taskId: text("task_id").primaryKey(),
  personId: text("person_id").notNull(),
  weekIndex: integer("week_index").notNull(),
  updatedAt: text("updated_at").notNull(),
});
