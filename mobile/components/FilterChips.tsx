import { Pressable, ScrollView, Text } from 'react-native';

export interface FilterChipOption {
  id: string;
  label: string;
}

interface FilterChipsProps {
  options: FilterChipOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  allowClear?: boolean;
}

export function FilterChips({ options, selectedId, onSelect, allowClear = true }: FilterChipsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-1 mt-1">
      {allowClear ? (
        <Pressable
          onPress={() => onSelect(null)}
          className={`mr-2 min-h-[44px] items-center justify-center rounded-full px-4 ${selectedId === null ? 'bg-primary' : 'border border-border bg-card'}`}
        >
          <Text className={`text-sm ${selectedId === null ? 'font-bold text-on-primary' : 'font-semibold text-ink'}`}>
            Any
          </Text>
        </Pressable>
      ) : null}
      {options.map((item) => {
        const active = selectedId === item.id;
        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item.id)}
            className={`mr-2 min-h-[44px] items-center justify-center rounded-full px-4 ${active ? 'bg-primary' : 'border border-border bg-card'}`}
          >
            <Text className={`text-sm ${active ? 'font-bold text-on-primary' : 'font-semibold text-ink'}`}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
