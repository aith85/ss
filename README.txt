JSON file format


"disclaimers": {
    "disclaimer1": { //mandatory - unique id
        "id": 1, //mandatory - type:integer
        "title": "Disclaimer title 1", //mandatory - type:string
        "text": "Lorem ipsum 1", //mandatory
        "URLs": [ //mandatory - type:array of strings
            "https://www.samsung.com/it/",
            "https://www.samsung.com/it/offer/"
        ],
        "div": "MX", //optional [MX,AV,IT,ALL]
        "startDate": "2024-01-01 00:00:00", //optional - type:date (ISO FORMAT: YYYY-MM-DD HH:mm:ss)
        "endDate": "2024-12-31 23:59:59", //optional - type:date (ISO FORMAT: YYYY-MM-DD HH:mm:ss)
    }
}
