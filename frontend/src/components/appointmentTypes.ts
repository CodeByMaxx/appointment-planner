export type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  active: boolean;
};

export type Appointment = {
  id: string;
  customerName: string;
  customerEmail: string;
  message?: string;
  startTime: string;
  endTime: string;
  status: string;
  service: Service;
};
