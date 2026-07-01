from fastapi import APIRouter

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)

@router.get("/analytics")
async def dashboard_analytics():

    return {

        "kpi_metrics": [
            {
                "label": "AI Hiring Success",
                "value": "95.1%",
                "change": "+3.2%",
                "color": "#06b6d4"
            },
            {
                "label": "Predicted Attrition",
                "value": "5.4%",
                "change": "-0.9%",
                "color": "#8b5cf6"
            },
            {
                "label": "Workforce Efficiency",
                "value": "89%",
                "change": "+4.1%",
                "color": "#10b981"
            },
            {
                "label": "Avg Time to Hire",
                "value": "12 Days",
                "change": "2 days faster",
                "color": "#f59e0b"
            }
        ],

        "attrition_data": [
            {
                "label": "Low Risk",
                "value": 70,
                "color": "#10b981"
            },
            {
                "label": "Medium Risk",
                "value": 20,
                "color": "#f59e0b"
            },
            {
                "label": "High Risk",
                "value": 10,
                "color": "#ef4444"
            }
        ],

        "attendance_data": [
            {
                "label": "Average Present",
                "value": "91%",
                "change": "+2%"
            },
            {
                "label": "Average Absent",
                "value": "9%",
                "change": "-1%"
            }
        ],

        "performance_index": [
            {
                "dept": "Engineering",
                "score": "92",
                "status": "Excellent"
            },
            {
                "dept": "HR",
                "score": "84",
                "status": "Good"
            }
        ],

        "team_heatmap_data": [
            {
                "team": "Engineering",
                "d1": 5,
                "d2": 4,
                "d3": 5,
                "d4": 5,
                "d5": 4
            }
        ]
    }