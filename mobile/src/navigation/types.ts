// Shared navigation types — imported by App.tsx and all screen components
// to avoid circular dependency between App and screens
export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  SurveyList: { templateId?: string };
  SurveyForm: { assignmentId: string; templateId: string; recordType: string; site_id: string };
  SubmissionDetail: { submissionId: string };
  Profile: undefined;
};
