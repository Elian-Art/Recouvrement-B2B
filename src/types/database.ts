export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          billing_email: string | null
          stripe_customer_id: string | null
          plan: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          billing_email?: string | null
          stripe_customer_id?: string | null
          plan?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          billing_email?: string | null
          stripe_customer_id?: string | null
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          org_id: string
          email: string
          full_name: string | null
          role: 'owner' | 'admin' | 'member'
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          email: string
          full_name?: string | null
          role?: 'owner' | 'admin' | 'member'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string | null
          role?: 'owner' | 'admin' | 'member'
          avatar_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'users_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      debtors: {
        Row: {
          id: string
          org_id: string
          company_name: string
          siret: string | null
          contact_name: string | null
          contact_email: string | null
          contact_phone: string | null
          address: string | null
          city: string | null
          postal_code: string | null
          country: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          company_name: string
          siret?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          siret?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'debtors_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      invoices: {
        Row: {
          id: string
          org_id: string
          debtor_id: string
          invoice_number: string
          amount_cents: number
          currency: string
          issued_at: string
          due_at: string
          status: 'pending' | 'overdue' | 'paid' | 'cancelled' | 'in_dispute'
          description: string | null
          stripe_payment_link: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          debtor_id: string
          invoice_number: string
          amount_cents: number
          currency?: string
          issued_at: string
          due_at: string
          status?: 'pending' | 'overdue' | 'paid' | 'cancelled' | 'in_dispute'
          description?: string | null
          stripe_payment_link?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          debtor_id?: string
          invoice_number?: string
          amount_cents?: number
          currency?: string
          issued_at?: string
          due_at?: string
          status?: 'pending' | 'overdue' | 'paid' | 'cancelled' | 'in_dispute'
          description?: string | null
          stripe_payment_link?: string | null
          paid_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_debtor_id_fkey'
            columns: ['debtor_id']
            isOneToOne: false
            referencedRelation: 'debtors'
            referencedColumns: ['id']
          }
        ]
      }
      reminders: {
        Row: {
          id: string
          org_id: string
          invoice_id: string
          channel: 'email' | 'sms'
          status: 'scheduled' | 'sent' | 'failed'
          scheduled_at: string
          sent_at: string | null
          subject: string | null
          body: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          invoice_id: string
          channel: 'email' | 'sms'
          status?: 'scheduled' | 'sent' | 'failed'
          scheduled_at: string
          sent_at?: string | null
          subject?: string | null
          body?: string | null
          created_at?: string
        }
        Update: {
          status?: 'scheduled' | 'sent' | 'failed'
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'reminders_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reminders_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          }
        ]
      }
      payments: {
        Row: {
          id: string
          org_id: string
          invoice_id: string
          amount_cents: number
          currency: string
          stripe_payment_intent_id: string | null
          stripe_charge_id: string | null
          paid_at: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          invoice_id: string
          amount_cents: number
          currency?: string
          stripe_payment_intent_id?: string | null
          stripe_charge_id?: string | null
          paid_at?: string
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: [
          {
            foreignKeyName: 'payments_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      formal_notices: {
        Row: {
          id: string
          org_id: string
          invoice_id: string
          pdf_url: string | null
          sent_at: string | null
          method: 'email' | 'mail' | 'both' | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          invoice_id: string
          pdf_url?: string | null
          sent_at?: string | null
          method?: 'email' | 'mail' | 'both' | null
          created_at?: string
        }
        Update: {
          pdf_url?: string | null
          sent_at?: string | null
          method?: 'email' | 'mail' | 'both' | null
        }
        Relationships: [
          {
            foreignKeyName: 'formal_notices_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<never, never>
    Functions: {
      get_user_org_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

// Convenience type aliases
export type Organization = Database['public']['Tables']['organizations']['Row']
export type UserProfile = Database['public']['Tables']['users']['Row']
export type Debtor = Database['public']['Tables']['debtors']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type Reminder = Database['public']['Tables']['reminders']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type FormalNotice = Database['public']['Tables']['formal_notices']['Row']

export type InvoiceStatus = Invoice['status']
export type UserRole = UserProfile['role']
