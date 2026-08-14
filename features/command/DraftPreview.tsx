import { Text, View } from 'react-native';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { PillChip } from '@/core/ui/PillChip';
import { TextField } from '@/core/ui/TextField';
import { ValidationError } from '@/core/ui/ValidationError';
import { useAppTheme } from '@/core/providers/themeContext';
import { type AppSection } from '@/core/providers/navigationContext';
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
import type { CommandReview } from './command.review';

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
  review,
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
  onEditV2Field,
  onSelectAmbiguousReference,
  onConfirm,
  onReset,
  onNavigateToDestination,
}: {
  parsedDraft: DraftAiAction;
  editableDraft: DraftAiAction;
  review: CommandReview | null;
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
  onEditV2Field: (field: string, value: string) => void;
  onSelectAmbiguousReference: (entityId: string, reference: string) => void;
  onConfirm: () => void;
  onReset: () => void;
  onNavigateToDestination?: (section: AppSection) => void;
}) {
  const { tokens } = useAppTheme();
  const destinationSection: AppSection =
    editableDraft.kind === 'create_todo' || editableDraft.kind === 'complete_todo'
      ? 'todos'
      : editableDraft.kind === 'create_habit' || editableDraft.kind === 'log_habit'
        ? 'habits'
        : editableDraft.kind === 'log_calorie_entry'
          ? 'calories'
          : editableDraft.kind === 'log_workout_routine'
            ? 'workout'
            : 'pomodoro';
  const destinationLabel =
    destinationSection === 'todos'
      ? 'Go to Todos'
      : destinationSection === 'habits'
        ? 'Go to Habits'
        : destinationSection === 'calories'
          ? 'Go to Calories'
          : destinationSection === 'workout'
            ? 'Go to Workout'
            : 'Go to Focus';
  const ambiguousMatches =
    review?.resolution?.status === 'ambiguous' ? review.resolution.matches : [];

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
          value={review?.preview.title ?? editableDraft.kind.replaceAll('_', ' ')}
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
        ) : editableDraft.kind === 'create_habit' ? (
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
        ) : (
          <>
            <PreviewSectionTitle>Command details</PreviewSectionTitle>
            <PreviewInfoRow label="Action" value={editableDraft.kind.replaceAll('_', ' ')} />
            <PreviewInfoRow label="Status" value={editableDraft.status} />
            {editableDraft.kind === 'complete_todo' ? (
              <TextField
                label="Todo title"
                value={editableDraft.fields.todoTitle ?? ''}
                onChangeText={(value) => onEditV2Field('todoTitle', value)}
                placeholder="Todo title"
                nativeID="command-edit-complete-todo-title"
              />
            ) : null}
            {editableDraft.kind === 'log_habit' ? (
              <TextField
                label="Habit name"
                value={editableDraft.fields.habitName ?? ''}
                onChangeText={(value) => onEditV2Field('habitName', value)}
                placeholder="Habit name"
                nativeID="command-edit-log-habit-name"
              />
            ) : null}
            {editableDraft.kind === 'log_calorie_entry' ? (
              <>
                <TextField
                  label="Food name"
                  value={editableDraft.fields.foodName ?? ''}
                  onChangeText={(value) => onEditV2Field('foodName', value)}
                  placeholder="Food name"
                  nativeID="command-edit-calorie-food"
                />
                <TextField
                  label="Calories"
                  value={
                    editableDraft.fields.calories == null
                      ? ''
                      : String(editableDraft.fields.calories)
                  }
                  onChangeText={(value) => onEditV2Field('calories', value)}
                  placeholder="Required"
                  keyboardType="numeric"
                  nativeID="command-edit-calorie-calories"
                />
                {(['protein', 'carbs', 'fats', 'fiber'] as const).map((field) => (
                  <TextField
                    key={field}
                    label={`${field[0].toUpperCase()}${field.slice(1)} (optional)`}
                    value={
                      editableDraft.fields[field] == null ? '' : String(editableDraft.fields[field])
                    }
                    onChangeText={(value) => onEditV2Field(field, value)}
                    placeholder="Optional"
                    keyboardType="numeric"
                    nativeID={`command-edit-calorie-${field}`}
                  />
                ))}
                <TextField
                  label="Consumed on (YYYY-MM-DD)"
                  value={editableDraft.fields.consumedOn ?? ''}
                  onChangeText={(value) => onEditV2Field('consumedOn', value)}
                  placeholder="Today by default"
                  nativeID="command-edit-calorie-date"
                />
                <PreviewSectionTitle>Meal</PreviewSectionTitle>
                <View className="flex-row flex-wrap">
                  {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => (
                    <PillChip
                      key={mealType}
                      label={mealType[0].toUpperCase() + mealType.slice(1)}
                      active={editableDraft.fields.mealType === mealType}
                      color={tokens.textMuted}
                      onPress={() => onEditV2Field('mealType', mealType)}
                    />
                  ))}
                </View>
              </>
            ) : null}
            {editableDraft.kind === 'log_workout_routine' ? (
              <TextField
                label="Routine name"
                value={editableDraft.fields.routineName ?? ''}
                onChangeText={(value) => onEditV2Field('routineName', value)}
                placeholder="Routine name"
                nativeID="command-edit-workout-routine"
              />
            ) : null}
            {editableDraft.kind === 'start_focus_session' ? (
              <TextField
                label="Duration (minutes)"
                value={
                  editableDraft.fields.durationMinutes == null
                    ? ''
                    : String(editableDraft.fields.durationMinutes)
                }
                onChangeText={(value) => onEditV2Field('durationMinutes', value)}
                placeholder="25"
                unsignedInteger
                nativeID="command-edit-focus-duration"
              />
            ) : null}
            {ambiguousMatches.length > 0 ? (
              <View className="gap-2" accessibilityLiveRegion="polite">
                <PreviewSectionTitle>Choose the matching item</PreviewSectionTitle>
                <Text className="text-sm" style={{ color: tokens.textMuted }}>
                  More than one active item has that name. Choose one before confirming.
                </Text>
                <View className="flex-row flex-wrap">
                  {ambiguousMatches.map((entity) => {
                    const reference = 'title' in entity ? entity.title : entity.name;
                    return (
                      <PillChip
                        key={entity.id}
                        label={reference}
                        active={review?.resolvedEntityId === entity.id}
                        color={tokens.textMuted}
                        onPress={() => onSelectAmbiguousReference(entity.id, reference)}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}
            {review?.preview.rows.map((row) => (
              <PreviewInfoRow
                key={`${row.label}:${row.value}`}
                label={row.label}
                value={row.value}
              />
            ))}
            {review?.preview.sideEffect ? (
              <PreviewInfoRow label="After confirmation" value={review.preview.sideEffect} />
            ) : null}
            <Text
              className="text-sm"
              style={{ color: tokens.textMuted }}
              accessibilityLiveRegion="polite"
            >
              Review the details above. This V2 action will stay unchanged until you confirm it.
            </Text>
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
