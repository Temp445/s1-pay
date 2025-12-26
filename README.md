# Ace Payroll - Import Feature Documentation

## Master Data Import Functionality

The application now supports importing master data from CSV, Excel (.xlsx), and JSON files for all major entities.

### Supported Entities

1. **Employees** - Employee master data with personal information
2. **Departments** - Organizational departments
3. **Roles** - Job roles and positions
4. **Leave Types** - Leave type definitions
5. **Holidays** - Company and public holidays
6. **Shifts** - Work shift definitions
7. **Payroll Components** - Salary and deduction components

### How to Use Import Feature

#### Method 1: Individual Entity Pages
1. Navigate to any master data page (Employees, Shifts, Holidays, etc.)
2. Click the "Import" button in the top-right corner
3. Upload your file using drag-and-drop or file selection
4. Review the data preview
5. Click "Import" to process the data

#### Method 2: Centralized Import (Settings Page)
1. Go to Dashboard → Settings → Master Data Import
2. Select the entity type you want to import
3. Follow the same upload and import process

### File Format Requirements

#### CSV Format
- First row must contain column headers
- Use comma (,) as delimiter
- Enclose text values in quotes if they contain commas
- Date format: YYYY-MM-DD (e.g., 2024-01-15)
- Time format: HH:MM (e.g., 09:00)

#### Excel Format (.xlsx)
- First row must contain column headers
- Data should be in the first worksheet
- Date and time formatting same as CSV

#### JSON Format
- Must be an array of objects
- Each object represents one record
- Field names should match the required column headers

### Required Fields by Entity

#### Employees
- **name** (string, 2-100 characters)
- **email** (valid email address, unique)
- **department** (string, must exist or be created first)
- **role** (string, must exist or be created first)
- **status** (Active, On Leave, or Terminated)
- **start_date** (date in YYYY-MM-DD format)

Optional fields: employee_code, address, date_of_birth

#### Departments
- **name** (string, 2-100 characters, unique)

#### Roles
- **name** (string, 2-100 characters, unique)

#### Leave Types
- **name** (string, 2-100 characters, unique)
- **default_days** (number, 0 or greater)

Optional fields: description, requires_approval (boolean), is_active (boolean), is_paid (boolean)

#### Holidays
- **name** (string, 2-100 characters)
- **date** (date in YYYY-MM-DD format)
- **holiday_type** (public or company)

Optional fields: description, is_recurring (boolean)

#### Shifts
- **name** (string, 2-100 characters)
- **start_time** (time in HH:MM format)
- **end_time** (time in HH:MM format)
- **shift_type** (morning, afternoon, or night)

Optional fields: description, break_duration (HH:MM:SS format), is_active (boolean)

#### Payroll Components
- **name** (string, 2-100 characters, unique)
- **component_type** (earning or deduction)

Optional fields: description, is_active (boolean)

### Data Validation

The import process includes comprehensive validation:

- **Required field validation** - Ensures all mandatory fields are present
- **Data type validation** - Validates numbers, dates, emails, and booleans
- **Format validation** - Checks date/time formats and patterns
- **Business rule validation** - Ensures data follows business constraints
- **Duplicate detection** - Prevents importing duplicate records
- **Referential integrity** - Validates relationships between entities

### Error Handling

If validation errors occur:
- The import process will continue for valid records
- Detailed error messages show which rows and fields have issues
- Row numbers correspond to the original file (including header row)
- Failed records are not imported, successful records are saved

### Sample Data

Download sample data files from:
- Individual entity pages (Import button → Download Sample Data)
- Settings → Master Data Import → Download Sample button for each entity

### Best Practices

1. **Start with dependencies first**: Import departments and roles before employees
2. **Use templates**: Download and use the provided templates for correct formatting
3. **Validate data**: Review the preview before importing
4. **Small batches**: For large datasets, consider importing in smaller batches
5. **Backup first**: Export existing data before importing new data
6. **Test with samples**: Use sample data to test the import process first

### Troubleshooting

**Common Issues:**
- **"Email already exists"**: Each employee email must be unique
- **"Invalid date format"**: Use YYYY-MM-DD format for dates
- **"Invalid time format"**: Use HH:MM format for times (24-hour)
- **"Department not found"**: Import departments before employees
- **"Role not found"**: Import roles before employees

**File Format Issues:**
- Ensure CSV files use UTF-8 encoding
- Excel files should not have merged cells or complex formatting
- JSON files must be valid JSON arrays

### Security and Data Integrity

- All imports are logged and audited
- Data validation prevents invalid data entry
- Existing data relationships are preserved
- Import operations are atomic (all or nothing for each record)
- User authentication is required for all import operations

For technical support or questions about the import feature, contact your system administrator.