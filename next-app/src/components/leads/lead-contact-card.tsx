import { User, Phone, Mail, MapPin, Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadContact } from "@/types/lead";

interface LeadContactCardProps {
  contact: LeadContact;
}

export function LeadContactCard({ contact }: LeadContactCardProps) {
  const lossAddress = [
    contact.address_loss,
    contact.city_loss,
    contact.state_loss,
    contact.zip_code_loss,
  ]
    .filter(Boolean)
    .join(", ");

  const mailingAddress = [
    contact.address,
    contact.city,
    contact.state,
    contact.zip_code,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contact Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="text-sm font-medium">{contact.full_name}</p>
              {contact.full_name_alt && (
                <p className="text-xs text-muted-foreground">
                  Alt: {contact.full_name_alt}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-medium">{contact.phone_number}</p>
              {contact.phone_number_alt && (
                <p className="text-xs text-muted-foreground">
                  Alt: {contact.phone_number_alt}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{contact.email || "N/A"}</p>
            </div>
          </div>
          {lossAddress && (
            <div className="flex items-start gap-3">
              <Home className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Loss Address</p>
                <p className="text-sm font-medium">{lossAddress}</p>
              </div>
            </div>
          )}
          {mailingAddress && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">
                  Mailing Address
                </p>
                <p className="text-sm font-medium">{mailingAddress}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
