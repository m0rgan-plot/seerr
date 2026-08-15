// A person as this feature needs to know them. The data layer builds these from the
// User entity so nothing below the mapper sees a persistence model, and the display
// fields are carried along rather than refetched when a list is rendered.
export interface UserRef {
  id: number;
  displayName: string;
  avatar: string;
}
