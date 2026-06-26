```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#D0E8FF', 'primaryBorderColor': '#7BAFD4', 'primaryTextColor': '#1a1a2e', 'fontSize': '14px', 'fontFamily': 'Segoe UI, sans-serif'}}}%%

usecaseDiagram
    %% Actors
    actor "User" as User
    actor "Anonymous User" as AnonymousUser
    actor "GitHub" as GitHub
    actor "System Administrator" as Admin

    %% System Boundary
    rectangle GHA_Cost_Predictor {
        %% Authentication Use Cases
        usecase "Register/Login" as UC_RegisterLogin

        %% Core Use Cases
        usecase "Predict Workflow Cost" as UC_PredictCost
        usecase "View Prediction History" as UC_ViewHistory
        usecase "Configure Webhooks" as UC_ConfigureWebhooks

        %% Batch/Repo Use Cases
        usecase "Predict Repo Workflows" as UC_PredictRepo

        %% Analytics Use Cases
        usecase "View Analytics" as UC_ViewAnalytics

        %% Admin Use Cases
        usecase "Manage ML Models" as UC_ManageModels
    }

    %% Actor-Use Case Associations
    User --> UC_PredictCost
    User --> UC_PredictRepo
    User --> UC_ViewHistory
    User --> UC_ViewAnalytics
    User --> UC_ConfigureWebhooks

    AnonymousUser --> UC_RegisterLogin
    AnonymousUser --> UC_PredictCost
    AnonymousUser --> UC_PredictRepo

    UC_RegisterLogin --> GitHub : <<include>>
    UC_ConfigureWebhooks --> GitHub : <<include>>

    Admin --> UC_ManageModels
    Admin --> UC_ConfigureWebhooks

    %% Styling
    classDef actorStyle fill:#D4F1E4,stroke:#6DBF9E,color:#1a1a2e
    classDef useCaseStyle fill:#D0E8FF,stroke:#7BAFD4,color:#1a1a2e
    classDef externalStyle fill:#EDE8FF,stroke:#9C8FD4,color:#1a1a2e
    classDef analyticsStyle fill:#FDE8C8,stroke:#E8A96A,color:#1a1a2e
    classDef adminStyle fill:#FFD6D6,stroke:#E07B7B,color:#1a1a2e

    class User,AnonymousUser actorStyle
    class UC_PredictCost,UC_PredictRepo,UC_ViewHistory,UC_ConfigureWebhooks,UC_RegisterLogin useCaseStyle
    class GitHub externalStyle
    class UC_ViewAnalytics analyticsStyle
    class Admin,UC_ManageModels adminStyle
```
