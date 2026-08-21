import { forwardRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  formatMoneyInput,
  isValidMoneyInput,
  parseMoneyInput,
} from "@/lib/money";

type MoneyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
  normalizeOnBlur?: boolean;
};

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    { value, onValueChange, normalizeOnBlur = true, onBlur, onFocus, ...props },
    ref,
  ) {
    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          if (isValidMoneyInput(event.target.value))
            onValueChange(event.target.value.replace(/\s/g, ""));
        }}
        onFocus={(event) => {
          if (value === "0") event.currentTarget.select();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          if (normalizeOnBlur && value !== "")
            onValueChange(formatMoneyInput(parseMoneyInput(value)));
          onBlur?.(event);
        }}
      />
    );
  },
);

type NumericMoneyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> & {
  value: number;
  onValueChange: (value: number) => void;
};

export function NumericMoneyInput({
  value,
  onValueChange,
  onBlur,
  onFocus,
  ...props
}: NumericMoneyInputProps) {
  const [draft, setDraft] = useState(() => formatMoneyInput(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatMoneyInput(value));
  }, [focused, value]);

  return (
    <MoneyInput
      {...props}
      value={draft}
      normalizeOnBlur={false}
      onValueChange={(nextDraft) => {
        setDraft(nextDraft);
        if (nextDraft !== "") onValueChange(parseMoneyInput(nextDraft));
      }}
      onFocus={(event) => {
        setFocused(true);
        if (draft === "0") event.currentTarget.select();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        const normalized = formatMoneyInput(parseMoneyInput(draft));
        setDraft(normalized);
        setFocused(false);
        onValueChange(parseMoneyInput(normalized));
        onBlur?.(event);
      }}
    />
  );
}
