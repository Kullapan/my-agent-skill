---
title: Define validation schemas separately from components using Zod or Yup
impact: MEDIUM
impactDescription: Inline validation logic scattered across event handlers is duplicated, untestable, and inconsistent.
tags: react, vue, forms, validation, zod, yup, schema
---

## Define validation schemas separately from components using Zod or Yup

**Impact: MEDIUM**

Validation rules embedded inside `onSubmit` handlers are impossible to share between client and server, difficult to unit-test in isolation, and inevitably drift out of sync across forms that operate on the same data. Defining a standalone schema with Zod or Yup gives you a single source of truth for validation, automatic TypeScript type inference, and seamless integration with form libraries.

**Incorrect (inline if/else validation in handler):**

```tsx
// ❌ Validation logic is buried inside the component – untestable and non-reusable
import { useForm } from 'react-hook-form';

function CheckoutForm() {
  const { register, handleSubmit, setError } = useForm();

  const onSubmit = (data: any) => {
    if (!data.email || !/^\S+@\S+$/i.test(data.email)) {
      setError('email', { message: 'Valid email is required' });
      return;
    }
    if (!data.cardNumber || data.cardNumber.replace(/\s/g, '').length !== 16) {
      setError('cardNumber', { message: 'Card number must be 16 digits' });
      return;
    }
    if (!data.expiry || !/^\d{2}\/\d{2}$/.test(data.expiry)) {
      setError('expiry', { message: 'Expiry must be MM/YY' });
      return;
    }
    // ...more ad-hoc checks
    submitOrder(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} placeholder="Email" />
      <input {...register('cardNumber')} placeholder="Card number" />
      <input {...register('expiry')} placeholder="MM/YY" />
      <button type="submit">Pay</button>
    </form>
  );
}
```

**Correct (Zod schema with zodResolver):**

```tsx
// ✅ Schema is standalone, testable, and infers the form's TypeScript type
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export const checkoutSchema = z.object({
  email: z.string().email('Valid email is required'),
  cardNumber: z
    .string()
    .transform((v) => v.replace(/\s/g, ''))
    .pipe(z.string().length(16, 'Card number must be 16 digits')),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/, 'Expiry must be MM/YY'),
});

export type CheckoutValues = z.infer<typeof checkoutSchema>;

function CheckoutForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
  });

  const onSubmit = (data: CheckoutValues) => {
    submitOrder(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} placeholder="Email" />
      {errors.email && <span>{errors.email.message}</span>}

      <input {...register('cardNumber')} placeholder="Card number" />
      {errors.cardNumber && <span>{errors.cardNumber.message}</span>}

      <input {...register('expiry')} placeholder="MM/YY" />
      {errors.expiry && <span>{errors.expiry.message}</span>}

      <button type="submit">Pay</button>
    </form>
  );
}
```

Because the schema is a plain exported object, you can reuse `checkoutSchema` in API route handlers for server-side validation and import it into unit tests without rendering any components.
