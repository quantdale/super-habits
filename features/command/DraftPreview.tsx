import { Text, View } from 'react-native';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { PillChip } from '@/core/ui/PillChip';
import { TextField } from '@/core/ui/TextField';
import { ValidationError } from '@/core/ui/ValidationError';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { type AppSection } from '@/core/providers/NavigationProvider';
import {
  PreviewInfoRow,
  PreviewMissingField,
  PreviewSectionTitle,
  PreviewWarning,
} from './CommandPreview';
import type {
  CommandExecutionResult,
  DraftAiAction,
  DraftCreateHabit,
  DraftCreateTodo,
  DraftMissingField,
} from './types';

const TODO_PRIORITIES: { value: DraftCreateTodo['fields']['priority']; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];
const HABIT_CATEGORIES: { value: DraftCreateHabit['fields']['category']; label: string }[] = [
  { value: 'anytime', label: 'Anytime' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

export function DraftPreview({
  parsedDraft,
  editableDraft,
  visibleMissingFields,
  canConfirm,
  busy,
  executionError,
  successResult,
  onEditTodoTitle,
  onEditTodoNotes,
  onEditTodoDueDate,
  onSetTodoDueDateToday,
  onSetTodoDueDateTomorrow,
  onClearTodoDueDate,
  onEditTodoPriority,
  onEditHabitName,
  onEditHabitTargetPerDay,
  onEditHabitCategory,
  onConfirm,
  onReset,
  onNavigateToDestination,
}: {
  parsedDraft: DraftAiAction;
  editableDraft: DraftAiAction;
  visibleMissingFields: DraftMissingField[];
  canConfirm: boolean;
  busy: boolean;
  executionError: string | null;
  successResult: Extract<CommandExecutionResult, { outcome: 'success' }> | null;
  onEditTodoTitle: (value: string) => void;
  onEditTodoNotes: (value: string) => void;
  onEditTodoDueDate: (value: string) => void;
  onSetTodoDueDateToday: () => void;
  onSetTodoDueDateTomorrow: () => void;
  onClearTodoDueDate: () => void;
  onEditTodoPriority: (value: DraftCreateTodo['fields']['priority']) => void;
  onEditHabitName: (value: string) => void;
  onEditHabitTargetPerDay: (value: string) => void;
  onEditHabitCategory: (value: DraftCreateHabit['fields']['category']) => void;
  onConfirm: () => void;
  onReset: () => void;
  onNavigateToDestination?: (section: AppSection) => void;
}) {
  const { tokens } = useAppTheme();
  const destinationSection: AppSection = editableDraft.kind === 'create_todo' ? 'todos' : 'habits';
  const destinationLabel = editableDraft.kind === 'create_todo' ? 'Go to Todos' : 'Go to Habits';

  return (
    <Card
      variant="header"
      accentColor={tokens.textMuted}
      headerTitle="Review before saving"
      headerSubtitle="Nothing has been saved yet."
      className="mb-0"
    >
      <View className="gap-3">
        <PreviewInfoRow
          label="Intent"
          value={editableDraft.kind === 'create_todo' ? 'Create todo' : 'Create habit'}
        />
        <PreviewInfoRow label="Parser status" value={parsedDraft.status} />
        <PreviewInfoRow label="Ready to save" value={canConfirm ? 'yes' : 'no'} />
        <PreviewInfoRow
          label="Parser"
          value={`${parsedDraft.parserKind} ${parsedDraft.parserVersion}`}
        />

        {editableDraft.kind === 'create_todo' ? (
          <>
            <PreviewSectionTitle>Todo fields</PreviewSectionTitle>
            <TextField
              label="Title"
              value={editableDraft.fields.title ?? ''}
              onChangeText={onEditTodoTitle}
              placeholder="Task title"
              nativeID="command-edit-todo-title"
            />
            <TextField
              label="Notes"
              value={editableDraft.fields.notes ?? ''}
              onChangeText={onEditTodoNotes}
              placeholder="Optional notes"
              nativeID="command-edit-todo-notes"
            />
            <TextField
              label="Due date (YYYY-MM-DD)"
              value={editableDraft.fields.dueDate ?? ''}
              onChangeText={onEditTodoDueDate}
              placeholder="YYYY-MM-DD"
              nativeID="command-edit-todo-due-date"
            />
            <View className="-mt-2 flex-row flex-wrap gap-2">
              <View>
                <Button label="Today" variant="ghost" onPress={onSetTodoDueDateToday} />
              </View>
              <View>
                <Button label="Tomorrow" variant="ghost" onPress={onSetTodoDueDateTomorrow} />
              </View>
              <View>
                <Button label="Clear" variant="ghost" onPress={onClearTodoDueDate} />
              </View>
            </View>
            <PreviewSectionTitle>Priority</PreviewSectionTitle>
            <View className="flex-row flex-wrap">
              {TODO_PRIORITIES.map((priority) => (
                <PillChip
                  key={priority.value}
                  label={priority.label}
                  active={editableDraft.fields.priority === priority.value}
                  color={tokens.textMuted}
                  onPress={() => onEditTodoPriority(priority.value)}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <PreviewSectionTitle>Habit fields</PreviewSectionTitle>
            <TextField
              label="Name"
              value={editableDraft.fields.name ?? ''}
              onChangeText={onEditHabitName}
              placeholder="Habit name"
              nativeID="command-edit-habit-name"
            />
            <TextField
              label="Target per day"
              value={
                Number.isFinite(editableDraft.fields.targetPerDay)
                  ? String(editableDraft.fields.targetPerDay)
                  : ''
              }
              onChangeText={onEditHabitTargetPerDay}
              placeholder="1"
              unsignedInteger
              nativeID="command-edit-habit-target"
            />
            <PreviewSectionTitle>Category</PreviewSectionTitle>
            <View className="flex-row flex-wrap">
              {HABIT_CATEGORIES.map((category) => (
                <PillChip
                  key={category.value}
                  label={category.label}
                  active={editableDraft.fields.category === category.value}
                  color={tokens.textMuted}
                  onPress={() => onEditHabitCategory(category.value)}
                />
              ))}
            </View>
            <PreviewInfoRow
              label="Defaults on save"
              value={`${editableDraft.fields.icon ?? 'default icon'}, ${editableDraft.fields.color ?? 'default color'}`}
            />
          </>
        )}

        {parsedDraft.warnings.length > 0 ? (
          <>
            <PreviewSectionTitle>Warnings</PreviewSectionTitle>
            {parsedDraft.warnings.map((warning) => (
              <PreviewWarning
                key={`${warning.code}:${warning.message}`}
                message={warning.message}
              />
            ))}
          </>
        ) : null}

        {visibleMissingFields.length > 0 ? (
          <>
            <PreviewSectionTitle>Needs input</PreviewSectionTitle>
            {visibleMissingFields.map((missing) => (
              <PreviewMissingField
                key={`${missing.field}:${missing.message}`}
                message={missing.message}
              />
            ))}
            {!canConfirm ? (
              <Text className="text-sm" style={{ color: tokens.textMuted }}>
                Fill required fields before saving.
              </Text>
            ) : null}
          </>
        ) : null}

        <ValidationError message={executionError} />

        {successResult ? (
          <View
            className="gap-2 rounded-xl border px-3 py-3"
            style={{ borderColor: tokens.successBorder, backgroundColor: tokens.successBackground }}
          >
            <Text className="text-sm font-semibold" style={{ color: tokens.successText }}>
              {successResult.message}
            </Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label={destinationLabel}
                  onPress={() => {
                    onNavigateToDestination?.(destinationSection);
                  }}
                  color={tokens.textMuted}
                />
              </View>
              <View className="flex-1">
                <Button label="New command" variant="ghost" onPress={onReset} />
              </View>
            </View>
          </View>
        ) : canConfirm ? (
          <Button
            label={busy ? 'Saving...' : 'Confirm and save'}
            onPress={onConfirm}
            color={tokens.textMuted}
            disabled={busy}
          />
        ) : (
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            Fill required fields before saving.
          </Text>
        )}
      </View>
    </Card>
  );
}
