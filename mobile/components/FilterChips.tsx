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
          className={`mr-2 rounded-full px-3 py-1.5 ${selectedId === null ? 'bg-primary' : 'border border-border bg-paper'}`}
        >
          <Text className={`text-xs font-semibold ${selectedId === null ? 'text-on-primary' : 'text-muted'}`}>
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
            className={`mr-2 rounded-full px-3 py-1.5 ${active ? 'bg-primary' : 'border border-border bg-paper'}`}
          >
            <Text className={`text-xs font-semibold ${active ? 'text-on-primary' : 'text-muted'}`}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
