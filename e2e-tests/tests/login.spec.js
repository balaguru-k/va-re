const { test, expect } = require('@playwright/test');

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page correctly', async ({ page }) => {
    await expect(page.locator('text=CownKore')).toBeVisible();
    await expect(page.locator('text=Making Audit Happen')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.click('button:has-text("Sign in")');
    
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@varewamp.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign in")');

    // Wait for navigation to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@varewamp.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("Sign in")');

    // Should stay on login page and show error
    await expect(page).toHaveURL('/login');
    await expect(page.locator('.bg-red-50')).toBeVisible();
  });
});

test.describe('User Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@varewamp.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should navigate to users page', async ({ page }) => {
    await page.click('text=Users');
    await expect(page).toHaveURL('/users');
    await expect(page.locator('text=Users').first()).toBeVisible();
    await expect(page.locator('button:has-text("Add User")')).toBeVisible();
  });

  test('should open add user modal', async ({ page }) => {
    await page.click('text=Users');
    await page.click('button:has-text("Add User")');
    
    await expect(page.locator('text=Add User').nth(1)).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="full_name"]')).toBeVisible();
    await expect(page.locator('select[name="role_id"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('should create new user', async ({ page }) => {
    await page.click('text=Users');
    await page.click('button:has-text("Add User")');
    
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="full_name"]', 'Test User');
    await page.selectOption('select[name="role_id"]', '2'); // Auditor role
    await page.fill('input[name="password"]', 'password123');
    
    await page.click('button:has-text("Create")');
    
    // Should close modal and show success message
    await expect(page.locator('text=Add User').nth(1)).not.toBeVisible();
  });
});

test.describe('Navigation and Logout', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@varewamp.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should navigate through sidebar menu items', async ({ page }) => {
    const menuItems = [
      { name: 'Dashboard', url: '/dashboard' },
      { name: 'Users', url: '/users' },
      { name: 'Checklists', url: '/checklists' },
      { name: 'Checklist Status', url: '/checklist-status' },
    ];

    for (const item of menuItems) {
      await page.click(`text=${item.name}`);
      await expect(page).toHaveURL(item.url);
    }
  });

  test('should logout successfully', async ({ page }) => {
    await page.click('text=Logout');
    
    // Should redirect to login page
    await expect(page).toHaveURL('/login');
    await expect(page.locator('text=CownKore')).toBeVisible();
  });
});