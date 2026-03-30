# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - heading "Create Account" [level=1] [ref=e6]
      - paragraph [ref=e7]: MediCore — Staff Registration
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]: Full Name
        - textbox "Dr. Jane Smith" [ref=e11]: E2E Reg 1774822713928
      - generic [ref=e12]:
        - generic [ref=e13]: Email
        - textbox "jane@medicore.nhs" [ref=e14]: e2e.reg.1774822713928@test.local
      - generic [ref=e15]:
        - generic [ref=e16]: Password
        - textbox "Min 8 characters" [active] [ref=e17]: Password123!
      - generic [ref=e18]:
        - generic [ref=e19]: Department (optional)
        - textbox "Cardiology" [ref=e20]
      - generic [ref=e21]:
        - generic [ref=e22]: Role
        - combobox [ref=e23]:
          - option "doctor"
          - option "nurse"
          - option "receptionist"
          - option "lab_tech"
          - option "patient" [selected]
      - button "Create Account" [ref=e24]
    - paragraph [ref=e25]:
      - text: Already have an account?
      - link "Sign in" [ref=e26] [cursor=pointer]:
        - /url: /login
  - region "Notifications Alt+T"
```