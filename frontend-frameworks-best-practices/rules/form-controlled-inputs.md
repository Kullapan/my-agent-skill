---
title: Use form libraries for complex forms instead of manual state management
impact: MEDIUM
impactDescription: Managing 10+ form fields with individual useState calls leads to boilerplate explosion and inconsistent validation.
tags: react, vue, forms, controlled-inputs, react-hook-form, vee-validate
---

## Use form libraries for complex forms instead of manual state management

**Impact: MEDIUM**

For forms with more than 3–4 fields, manual `useState` per field creates enormous boilerplate, makes validation inconsistent, and tightly couples rendering to state updates. Form libraries like React Hook Form, Formik, or VeeValidate handle registration, dirty tracking, error mapping, and submission in a declarative, performant way.

**Incorrect (individual useState per field):**

```tsx
// ❌ Boilerplate explosion – each field needs its own state, onChange, and validation
import { useState, FormEvent } from 'react';

function RegistrationForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!firstName) newErrors.firstName = 'First name is required';
    if (!email.includes('@')) newErrors.email = 'Invalid email';
    if (password.length < 8) newErrors.password = 'Min 8 characters';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords must match';
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      // submit
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      {errors.firstName && <span>{errors.firstName}</span>}
      {/* ...repeated for every field */}
    </form>
  );
}
```

**Correct (React Hook Form):**

```tsx
// ✅ Declarative registration, built-in validation, minimal re-renders
import { useForm } from 'react-hook-form';

interface RegistrationValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

function RegistrationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegistrationValues>();

  const onSubmit = (data: RegistrationValues) => {
    console.log('Submitting:', data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('firstName', { required: 'First name is required' })} />
      {errors.firstName && <span>{errors.firstName.message}</span>}

      <input {...register('email', { required: true, pattern: /^\S+@\S+$/i })} />
      {errors.email && <span>Invalid email</span>}

      <input
        type="password"
        {...register('password', { required: true, minLength: 8 })}
      />
      {errors.password && <span>Min 8 characters</span>}

      <input
        type="password"
        {...register('confirmPassword', {
          validate: (val) => val === watch('password') || 'Passwords must match',
        })}
      />
      {errors.confirmPassword && <span>{errors.confirmPassword.message}</span>}

      <button type="submit">Register</button>
    </form>
  );
}
```

React Hook Form uses uncontrolled inputs by default, which dramatically reduces re-renders compared to the manual `useState` approach.
