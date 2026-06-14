---
title: Test user behavior, not implementation details
impact: MEDIUM
impactDescription: Tests that assert on internal state or CSS classes break on every refactor, providing false negatives and zero confidence.
tags: react, vue, testing, testing-library, user-behavior, unit-tests
---

## Test user behavior, not implementation details

**Impact: MEDIUM**

Tests coupled to implementation details — internal component state, specific CSS class names, or DOM structure — break the moment you refactor, even when the actual user-facing behavior is unchanged. Following Testing Library's guiding principle ("the more your tests resemble the way your software is used, the more confidence they can give you"), you should query elements by accessible role, label, or visible text and assert on outcomes a user would observe.

**Incorrect (asserting on internal state and CSS classes):**

```tsx
// ❌ Test is coupled to implementation – breaks on any refactor
import { mount } from 'enzyme';
import Dropdown from './Dropdown';

test('opens the dropdown when clicked', () => {
  const wrapper = mount(<Dropdown items={['Apple', 'Banana', 'Cherry']} />);

  // Reaching into internal state
  expect(wrapper.state('isOpen')).toBe(false);

  wrapper.find('.dropdown-toggle').simulate('click');

  // Asserting on CSS class and internal state
  expect(wrapper.state('isOpen')).toBe(true);
  expect(wrapper.find('.dropdown-menu').exists()).toBe(true);
  expect(wrapper.find('.dropdown-menu').hasClass('is-visible')).toBe(true);
});
```

**Correct (asserting on visible user outcomes):**

```tsx
// ✅ Test mirrors real user interaction – survives refactors
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dropdown from './Dropdown';

test('shows options when the user opens the dropdown', async () => {
  const user = userEvent.setup();
  render(<Dropdown items={['Apple', 'Banana', 'Cherry']} />);

  // The listbox should not be visible initially
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

  // Click the toggle button by its accessible role
  await user.click(screen.getByRole('button', { name: /select an option/i }));

  // Assert that the user can see the options
  const listbox = screen.getByRole('listbox');
  expect(listbox).toBeVisible();
  expect(screen.getByRole('option', { name: 'Apple' })).toBeVisible();
  expect(screen.getByRole('option', { name: 'Cherry' })).toBeVisible();
});
```

If your test would still pass after completely rewriting the component's internals (state management, class names, DOM nesting) while keeping the same user-facing behavior, you have a resilient test.
