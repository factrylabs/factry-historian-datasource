import React from 'react';

import { SelectableValue } from '@grafana/data';
import { AddButton } from './AddButton';
import { Seg } from './Seg';

function toSelectableValue<T extends string>(t: T): SelectableValue<T> {
  return { label: t, value: t };
}

function isRegex(text: string): boolean {
  return /^\/.*\/$/.test(text)
}

function getOperator(tag: QueryTag): string {
  return tag.operator ?? (isRegex(tag.value) ? '=~' : '=');
}

function getCondition(tag: QueryTag, isFirst: boolean): string | undefined {
  return isFirst ? undefined : tag.condition ?? 'AND';
}

function adjustOperatorIfNeeded(currentOperator: string, newTagValue: string): string {
  const isCurrentOperatorRegex = currentOperator === '=~' || currentOperator === '!~';
  const isNewTagValueRegex = isRegex(newTagValue);

  if (isNewTagValueRegex) {
    return isCurrentOperatorRegex ? currentOperator : '=~';
  } else {
    return isCurrentOperatorRegex ? '=' : currentOperator;
  }
}

export interface QueryTag {
  key: string;
  operator?: string;
  condition?: string;
  value: string;
}
type KnownOperator = '='
const knownOperators: KnownOperator[] = ['=']

type KnownCondition = 'AND' | 'OR';
const knownConditions: KnownCondition[] = ['AND', 'OR'];

const operatorOptions: Array<SelectableValue<KnownOperator>> = knownOperators.map(toSelectableValue);
const condititonOptions: Array<SelectableValue<KnownCondition>> = knownConditions.map(toSelectableValue);

type Props = {
  tags: QueryTag[];
  onChange: (tags: QueryTag[]) => void;
  getTagKeyOptions: () => Promise<string[]>;
  getTagValueOptions: (key: string) => Promise<string[]>;
};

type TagProps = {
  tag: QueryTag;
  isFirst: boolean;
  onRemove: () => void;
  onChange: (tag: QueryTag) => void;
  getTagKeyOptions: () => Promise<string[]>;
  getTagValueOptions: (key: string) => Promise<string[]>;
};

const loadConditionOptions = () => Promise.resolve(condititonOptions);

const loadOperatorOptions = () => Promise.resolve(operatorOptions);

const Tag = ({ tag, isFirst, onRemove, onChange, getTagKeyOptions, getTagValueOptions }: TagProps): JSX.Element => {
  const operator = getOperator(tag);
  const condition = getCondition(tag, isFirst);

  const getTagKeySegmentOptions = () => {
    return getTagKeyOptions()
      .catch((err) => {
        // in this UI element we add a special item to the list of options,
        // that is used to remove the element.
        // this causes a problem: if `getTagKeyOptions` fails with an error,
        // the remove-filter option is never added to the list,
        // and the UI element can not be removed.
        // to avoid it, we catch any potential errors coming from `getTagKeyOptions`,
        // log the error, and pretend that the list of options is an empty list.
        // this way the remove-item option can always be added to the list.
        console.error(err);
        return [];
      })
      .then((tags) => [{ label: '-- remove filter --', value: undefined }, ...tags.map(toSelectableValue)]);
  };

  const getTagValueSegmentOptions = () => {
    return getTagValueOptions(tag.key).then((tags) => tags.map(toSelectableValue));
  };

  return (
    <div className="gf-form">
      {condition != null && (
        <Seg
          value={condition}
          loadOptions={loadConditionOptions}
          onChange={(v) => {
            onChange({ ...tag, condition: v.value });
          }}
        />
      )}
      <Seg
        allowCustomValue
        value={tag.key}
        loadOptions={getTagKeySegmentOptions}
        onChange={(v) => {
          const { value } = v;
          if (value === undefined) {
            onRemove();
          } else {
            onChange({ ...tag, key: value ?? '' });
          }
        }}
      />
      <Seg
        value={operator}
        loadOptions={loadOperatorOptions}
        onChange={(op) => {
          onChange({ ...tag, operator: op.value });
        }}
      />
      <Seg
        allowCustomValue
        value={tag.value}
        loadOptions={getTagValueSegmentOptions}
        onChange={(v) => {
          const value = v.value ?? '';
          onChange({ ...tag, value, operator: adjustOperatorIfNeeded(operator, value) });
        }}
      />
    </div>
  )
}

export const TagsSection = ({ tags, onChange, getTagKeyOptions, getTagValueOptions }: Props): JSX.Element => {
  const onTagChange = (newTag: QueryTag, index: number) => {
    const newTags = tags.map((tag, i) => {
      return index === i ? newTag : tag;
    });
    onChange(newTags);
  }

  const onTagRemove = (index: number) => {
    const newTags = tags.filter((t, i) => i !== index);
    onChange(newTags);
  }

  const getTagKeySegmentOptions = () => {
    return getTagKeyOptions().then((tags) => tags.map(toSelectableValue));
  }

  const addNewTag = (tagKey: string, isFirst: boolean) => {
    const minimalTag: QueryTag = {
      key: tagKey,
      value: 'select tag value',
    }

    const newTag: QueryTag = {
      key: minimalTag.key,
      value: minimalTag.value,
      operator: getOperator(minimalTag),
      condition: getCondition(minimalTag, isFirst),
    }

    onChange([...tags, newTag])
  }

  return (
    <>
      {tags.map((t, i) => (
        <Tag
          tag={t}
          isFirst={i === 0}
          key={i}
          onChange={(newT) => {
            onTagChange(newT, i)
          }}
          onRemove={() => {
            onTagRemove(i)
          }}
          getTagKeyOptions={getTagKeyOptions}
          getTagValueOptions={getTagValueOptions}
        />
      ))}
      <AddButton
        allowCustomValue
        loadOptions={getTagKeySegmentOptions}
        onAdd={(v) => {
          addNewTag(v, tags.length === 0)
        }}
      />
    </>
  )
}
